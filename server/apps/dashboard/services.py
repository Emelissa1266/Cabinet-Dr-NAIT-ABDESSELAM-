from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.agenda.models import Appointment
from apps.audit.models import AuditLog
from apps.billing.models import MONEY_ZERO, Invoice
from apps.care.models import Care, CareSession
from apps.notifications.models import Notification
from apps.notifications.services import surgery_needs_preop_attention
from apps.payments.models import Payment
from apps.surgery.models import PostoperativeFollowUp, Surgery

APPOINTMENT_TERMINAL_STATUSES = {
    Appointment.Status.CANCELLED,
    Appointment.Status.COMPLETED,
    Appointment.Status.NO_SHOW,
}
CARE_TERMINAL_STATUSES = {Care.Status.COMPLETED, Care.Status.CANCELLED}
CARE_SESSION_TERMINAL_STATUSES = {CareSession.Status.COMPLETED, CareSession.Status.CANCELLED}
SURGERY_TERMINAL_STATUSES = {Surgery.Status.COMPLETED, Surgery.Status.CANCELLED}


def day_bounds(day=None):
    day = day or timezone.localdate()
    start = timezone.make_aware(timezone.datetime.combine(day, timezone.datetime.min.time()))
    end = start + timezone.timedelta(days=1)
    return start, end


def upcoming_lower_bound(now):
    _, today_end = day_bounds()
    return max(now, today_end)


def money(value):
    return f"{(value or MONEY_ZERO):.2f}"


def patient_name(patient):
    return f"{patient.first_name} {patient.last_name}".strip() or "Patient"


def appointment_staff_queryset(user):
    return Appointment.objects.filter(Q(primary_staff=user) | Q(staff_members__user=user)).distinct()


def active_appointments(queryset):
    return queryset.exclude(status__in=APPOINTMENT_TERMINAL_STATUSES)


def appointment_preview(queryset, limit=None):
    limit = limit or settings.DASHBOARD_PREVIEW_LIMIT
    return [
        {
            "id": appointment.id,
            "patient_name": patient_name(appointment.patient),
            "appointment_type_name": appointment.appointment_type.name,
            "primary_staff_name": appointment.primary_staff.get_full_name() or appointment.primary_staff.username,
            "start_at": appointment.start_at,
            "status": appointment.status,
        }
        for appointment in queryset.select_related("patient", "appointment_type", "primary_staff").order_by("start_at")[:limit]
    ]


def surgery_preview(queryset, limit=None):
    limit = limit or settings.DASHBOARD_PREVIEW_LIMIT
    return [
        {
            "id": surgery.id,
            "patient_name": patient_name(surgery.patient),
            "procedure_name": surgery.intervention_type.name if surgery.intervention_type_id else surgery.procedure_name,
            "planned_date": surgery.planned_date,
            "status": surgery.status,
        }
        for surgery in queryset.select_related("patient", "intervention_type").order_by("planned_date")[:limit]
    ]


def care_session_preview(queryset, limit=None):
    limit = limit or settings.DASHBOARD_PREVIEW_LIMIT
    return [
        {
            "id": session.id,
            "patient_name": patient_name(session.care.patient),
            "care_type_name": session.care.care_type.name,
            "scheduled_at": session.scheduled_at,
            "status": session.status,
            "planned_sessions": session.care.planned_sessions,
        }
        for session in queryset.select_related("care", "care__patient", "care__care_type").order_by("scheduled_at", "created_at")[:limit]
    ]


def unread_count(user):
    return Notification.objects.filter(recipient=user, is_read=False).count()


def financial_summary():
    active_invoices = Invoice.objects.exclude(status__in=[Invoice.Status.CANCELLED, Invoice.Status.PAID])
    outstanding = sum((invoice.remaining_amount for invoice in active_invoices), Decimal("0.00"))
    overdue_invoices = [invoice for invoice in active_invoices if invoice.is_overdue]
    overdue_amount = sum((invoice.remaining_amount for invoice in overdue_invoices), Decimal("0.00"))
    today_start, today_end = day_bounds()
    paid_today = Payment.objects.filter(
        status=Payment.Status.COMPLETED,
        paid_at__gte=today_start,
        paid_at__lt=today_end,
    ).aggregate(total=Sum("amount"))["total"] or MONEY_ZERO
    return {
        "outstanding_amount": money(outstanding),
        "overdue_amount": money(overdue_amount),
        "paid_today": money(paid_today),
        "unpaid_invoices_count": active_invoices.filter(status=Invoice.Status.ISSUED).count(),
        "partially_paid_invoices_count": active_invoices.filter(status=Invoice.Status.PARTIALLY_PAID).count(),
        "overdue_invoices_count": len(overdue_invoices),
    }


def doctor_dashboard(user):
    now = timezone.now()
    today_start, today_end = day_bounds()
    upcoming_start = upcoming_lower_bound(now)
    horizon = now + timezone.timedelta(days=settings.DASHBOARD_UPCOMING_DAYS)
    appointments = appointment_staff_queryset(user)
    today_appointments = active_appointments(appointments.filter(start_at__gte=today_start, start_at__lt=today_end))
    upcoming_appointments = active_appointments(appointments.filter(start_at__gte=upcoming_start, start_at__lt=horizon))
    upcoming_surgeries = Surgery.objects.filter(
        surgeon=user,
        planned_date__gt=now,
        planned_date__lt=horizon,
    ).exclude(status__in=SURGERY_TERMINAL_STATUSES)
    preop_attention_count = sum(1 for surgery in upcoming_surgeries if surgery_needs_preop_attention(surgery))
    followups = PostoperativeFollowUp.objects.filter(
        doctor=user,
        follow_up_date__gt=now,
        follow_up_date__lt=horizon,
    )
    active_care = Care.objects.filter(prescribed_by=user).exclude(status__in=CARE_TERMINAL_STATUSES)
    return {
        "role": user.role,
        "today": {
            "appointments_count": today_appointments.count(),
            "appointments": appointment_preview(today_appointments),
        },
        "upcoming": {
            "appointments_count": upcoming_appointments.count(),
            "appointments": appointment_preview(upcoming_appointments),
            "surgeries_count": upcoming_surgeries.count(),
            "surgeries": surgery_preview(upcoming_surgeries),
            "postoperative_followups_count": followups.count(),
        },
        "pending": {
            "appointments_in_progress_count": appointments.filter(status=Appointment.Status.IN_PROGRESS).count(),
            "preop_attention_count": preop_attention_count,
            "active_care_count": active_care.count(),
        },
        "statistics": {
            "unread_notifications_count": unread_count(user),
        },
    }


def nurse_dashboard(user):
    now = timezone.now()
    today_start, today_end = day_bounds()
    upcoming_start = upcoming_lower_bound(now)
    horizon = now + timezone.timedelta(days=settings.DASHBOARD_UPCOMING_DAYS)
    appointments = appointment_staff_queryset(user)
    today_appointments = active_appointments(appointments.filter(start_at__gte=today_start, start_at__lt=today_end))
    upcoming_appointments = active_appointments(appointments.filter(start_at__gte=upcoming_start, start_at__lt=horizon))
    sessions = CareSession.objects.select_related("care", "care__patient", "care__care_type").filter(nurse=user)
    today_sessions = sessions.filter(scheduled_at__gte=today_start, scheduled_at__lt=today_end)
    upcoming_sessions = sessions.filter(scheduled_at__gte=upcoming_start, scheduled_at__lt=horizon).exclude(status__in=CARE_SESSION_TERMINAL_STATUSES)
    completed_today = sessions.filter(status=CareSession.Status.COMPLETED).filter(
        Q(completed_at__gte=today_start, completed_at__lt=today_end)
        | Q(completed_at__isnull=True, scheduled_at__gte=today_start, scheduled_at__lt=today_end),
    )
    active_care = Care.objects.filter(assigned_nurse=user).exclude(status__in=CARE_TERMINAL_STATUSES)
    return {
        "role": user.role,
        "today": {
            "appointments_count": today_appointments.count(),
            "appointments": appointment_preview(today_appointments),
            "planned_sessions_count": today_sessions.exclude(status__in=CARE_SESSION_TERMINAL_STATUSES).count(),
            "completed_sessions_count": completed_today.count(),
        },
        "upcoming": {
            "appointments_count": upcoming_appointments.count(),
            "appointments": appointment_preview(upcoming_appointments),
            "care_sessions_count": upcoming_sessions.count(),
            "care_sessions": care_session_preview(upcoming_sessions),
        },
        "pending": {
            "appointments_in_progress_count": appointments.filter(status=Appointment.Status.IN_PROGRESS).count(),
            "in_progress_sessions_count": sessions.filter(status=CareSession.Status.IN_PROGRESS).count(),
            "assigned_care_count": active_care.count(),
        },
        "statistics": {
            "unread_notifications_count": unread_count(user),
        },
    }


def secretary_dashboard(user):
    now = timezone.now()
    today_start, today_end = day_bounds()
    upcoming_start = upcoming_lower_bound(now)
    horizon = now + timezone.timedelta(days=settings.DASHBOARD_UPCOMING_DAYS)
    today_appointments = Appointment.objects.filter(start_at__gte=today_start, start_at__lt=today_end)
    upcoming_appointments = active_appointments(Appointment.objects.filter(start_at__gte=upcoming_start, start_at__lt=horizon))
    active_today = active_appointments(today_appointments)
    return {
        "role": user.role,
        "today": {
            "appointments_count": active_today.count(),
            "patients_scheduled_count": active_today.values("patient_id").distinct().count(),
            "checked_in_count": today_appointments.filter(status=Appointment.Status.CHECKED_IN).count(),
            "appointments": appointment_preview(active_today),
        },
        "upcoming": {
            "appointments_count": upcoming_appointments.count(),
            "appointments": appointment_preview(upcoming_appointments),
        },
        "pending": {
            "cancelled_count": today_appointments.filter(status=Appointment.Status.CANCELLED).count(),
            "no_show_count": today_appointments.filter(status=Appointment.Status.NO_SHOW).count(),
        },
        "financial": financial_summary(),
        "statistics": {
            "unread_notifications_count": unread_count(user),
        },
    }


def admin_dashboard(user):
    now = timezone.now()
    today_start, today_end = day_bounds()
    horizon = now + timezone.timedelta(days=settings.DASHBOARD_UPCOMING_DAYS)
    recent_activity = [
        {
            "actor": log.user.get_full_name() if log.user else "",
            "action": log.action,
            "entity_type": log.entity_type,
            "created_at": log.created_at,
        }
        for log in AuditLog.objects.select_related("user").order_by("-created_at")[: settings.DASHBOARD_PREVIEW_LIMIT]
    ]
    return {
        "role": user.role,
        "today": {
            "appointments_count": Appointment.objects.filter(start_at__gte=today_start, start_at__lt=today_end)
            .exclude(status__in=APPOINTMENT_TERMINAL_STATUSES)
            .count(),
        },
        "upcoming": {
            "surgeries_count": Surgery.objects.filter(
                planned_date__gt=now,
                planned_date__lt=horizon,
            )
            .exclude(status__in=SURGERY_TERMINAL_STATUSES)
            .count(),
        },
        "pending": {
            "care_workload_count": CareSession.objects.exclude(status__in=CARE_SESSION_TERMINAL_STATUSES).count(),
        },
        "financial": financial_summary(),
        "statistics": {
            "active_users_count": User.objects.filter(is_active=True).count(),
            "notifications_unread_count": unread_count(user),
            "appointments_by_status": dict(
                Appointment.objects.values_list("status").annotate(count=Count("id")).values_list("status", "count"),
            ),
        },
        "recent_activity": recent_activity,
    }


def get_dashboard_for_user(user):
    if user.role == User.Role.DOCTOR:
        return doctor_dashboard(user)
    if user.role == User.Role.NURSE:
        return nurse_dashboard(user)
    if user.role == User.Role.SECRETARY:
        return secretary_dashboard(user)
    return admin_dashboard(user)
