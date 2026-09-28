from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Sum
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


def day_bounds(day=None):
    day = day or timezone.localdate()
    start = timezone.make_aware(timezone.datetime.combine(day, timezone.datetime.min.time()))
    end = start + timezone.timedelta(days=1)
    return start, end


def money(value):
    return f"{(value or MONEY_ZERO):.2f}"


def appointment_preview(queryset, limit=None):
    limit = limit or settings.DASHBOARD_PREVIEW_LIMIT
    return [
        {
            "id": appointment.id,
            "patient_reference": appointment.patient.patient_reference,
            "start_at": appointment.start_at,
            "status": appointment.status,
        }
        for appointment in queryset.select_related("patient").order_by("start_at")[:limit]
    ]


def surgery_preview(queryset, limit=None):
    limit = limit or settings.DASHBOARD_PREVIEW_LIMIT
    return [
        {
            "id": surgery.id,
            "patient_reference": surgery.patient.patient_reference,
            "procedure_name": surgery.procedure_name,
            "planned_date": surgery.planned_date,
            "status": surgery.status,
        }
        for surgery in queryset.select_related("patient").order_by("planned_date")[:limit]
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
    today_start, today_end = day_bounds()
    horizon = today_start + timezone.timedelta(days=settings.DASHBOARD_UPCOMING_DAYS)
    today_appointments = Appointment.objects.filter(
        primary_staff=user,
        start_at__gte=today_start,
        start_at__lt=today_end,
    )
    upcoming_surgeries = Surgery.objects.filter(
        surgeon=user,
        planned_date__gte=today_start,
        planned_date__lt=horizon,
    ).exclude(status__in=[Surgery.Status.COMPLETED, Surgery.Status.CANCELLED])
    preop_attention_count = sum(1 for surgery in upcoming_surgeries if surgery_needs_preop_attention(surgery))
    followups = PostoperativeFollowUp.objects.filter(
        doctor=user,
        follow_up_date__gte=today_start,
        follow_up_date__lt=horizon,
    )
    return {
        "role": user.role,
        "today": {
            "appointments_count": today_appointments.count(),
            "appointments": appointment_preview(today_appointments),
        },
        "upcoming": {
            "surgeries_count": upcoming_surgeries.count(),
            "surgeries": surgery_preview(upcoming_surgeries),
            "postoperative_followups_count": followups.count(),
        },
        "pending": {
            "preop_attention_count": preop_attention_count,
        },
        "statistics": {
            "unread_notifications_count": unread_count(user),
        },
    }


def nurse_dashboard(user):
    today_start, today_end = day_bounds()
    horizon = today_start + timezone.timedelta(days=settings.DASHBOARD_UPCOMING_DAYS)
    sessions = CareSession.objects.select_related("care", "care__patient").filter(nurse=user)
    today_sessions = sessions.filter(scheduled_at__gte=today_start, scheduled_at__lt=today_end)
    upcoming = sessions.filter(scheduled_at__gte=today_end, scheduled_at__lt=horizon).exclude(
        status__in=[CareSession.Status.COMPLETED, CareSession.Status.CANCELLED],
    )
    return {
        "role": user.role,
        "today": {
            "assigned_sessions_count": today_sessions.count(),
            "completed_sessions_count": today_sessions.filter(status=CareSession.Status.COMPLETED).count(),
        },
        "upcoming": {
            "care_sessions_count": upcoming.count(),
            "care_sessions": [
                {
                    "id": session.id,
                    "patient_reference": session.care.patient.patient_reference,
                    "scheduled_at": session.scheduled_at,
                    "status": session.status,
                }
                for session in upcoming.order_by("scheduled_at")[: settings.DASHBOARD_PREVIEW_LIMIT]
            ],
        },
        "pending": {
            "in_progress_sessions_count": sessions.filter(status=CareSession.Status.IN_PROGRESS).count(),
            "assigned_care_count": Care.objects.filter(assigned_nurse=user).exclude(status=Care.Status.COMPLETED).count(),
        },
        "statistics": {
            "unread_notifications_count": unread_count(user),
        },
    }


def secretary_dashboard(user):
    today_start, today_end = day_bounds()
    horizon = today_start + timezone.timedelta(days=settings.DASHBOARD_UPCOMING_DAYS)
    today_appointments = Appointment.objects.filter(start_at__gte=today_start, start_at__lt=today_end)
    upcoming_appointments = Appointment.objects.filter(start_at__gte=today_end, start_at__lt=horizon)
    return {
        "role": user.role,
        "today": {
            "appointments_count": today_appointments.count(),
            "patients_scheduled_count": today_appointments.values("patient_id").distinct().count(),
            "checked_in_count": today_appointments.filter(status=Appointment.Status.CHECKED_IN).count(),
            "appointments": appointment_preview(today_appointments),
        },
        "upcoming": {
            "appointments_count": upcoming_appointments.count(),
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
    today_start, today_end = day_bounds()
    horizon = today_start + timezone.timedelta(days=settings.DASHBOARD_UPCOMING_DAYS)
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
            "appointments_count": Appointment.objects.filter(start_at__gte=today_start, start_at__lt=today_end).count(),
        },
        "upcoming": {
            "surgeries_count": Surgery.objects.filter(
                planned_date__gte=today_start,
                planned_date__lt=horizon,
            )
            .exclude(status__in=[Surgery.Status.COMPLETED, Surgery.Status.CANCELLED])
            .count(),
        },
        "pending": {
            "care_workload_count": CareSession.objects.exclude(
                status__in=[CareSession.Status.COMPLETED, CareSession.Status.CANCELLED],
            ).count(),
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
