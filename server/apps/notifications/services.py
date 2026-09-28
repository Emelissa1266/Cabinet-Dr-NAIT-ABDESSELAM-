from collections import Counter
from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.agenda.models import Appointment
from apps.audit.services import record_audit_event
from apps.billing.models import Invoice
from apps.care.models import CareSession
from apps.surgery.models import Surgery
from apps.surgery.services import validate_surgery_readiness

from .models import Notification


@dataclass
class ReminderResult:
    appointments_created: int = 0
    surgeries_created: int = 0
    preop_created: int = 0
    care_created: int = 0
    billing_created: int = 0

    @property
    def total_created(self) -> int:
        return (
            self.appointments_created
            + self.surgeries_created
            + self.preop_created
            + self.care_created
            + self.billing_created
        )

    def as_dict(self) -> dict:
        return {
            "appointments_created": self.appointments_created,
            "surgeries_created": self.surgeries_created,
            "preop_created": self.preop_created,
            "care_created": self.care_created,
            "billing_created": self.billing_created,
            "total_created": self.total_created,
        }


def create_notification(*, recipient, deduplication_key: str | None = None, **kwargs) -> Notification | None:
    try:
        with transaction.atomic():
            notification, created = Notification.objects.get_or_create(
                deduplication_key=deduplication_key,
                defaults={"recipient": recipient, **kwargs},
            )
    except IntegrityError:
        return None
    return notification if created else None


def mark_notification_read(*, notification: Notification, actor, request=None) -> Notification:
    if notification.recipient_id != actor.id:
        raise ValidationError("Cannot modify another user's notification.")
    notification.is_read = True
    notification.read_at = timezone.now()
    notification.save(update_fields=["is_read", "read_at", "updated_at"])
    record_audit_event(
        user=actor,
        action="NOTIFICATION_MARKED_READ",
        entity_type="Notification",
        entity_id=notification.pk,
        request=request,
    )
    return notification


def mark_notification_unread(*, notification: Notification, actor, request=None) -> Notification:
    if notification.recipient_id != actor.id:
        raise ValidationError("Cannot modify another user's notification.")
    notification.is_read = False
    notification.read_at = None
    notification.save(update_fields=["is_read", "read_at", "updated_at"])
    record_audit_event(
        user=actor,
        action="NOTIFICATION_MARKED_UNREAD",
        entity_type="Notification",
        entity_id=notification.pk,
        request=request,
    )
    return notification


def mark_all_notifications_read(*, actor, request=None) -> int:
    now = timezone.now()
    updated = Notification.objects.filter(recipient=actor, is_read=False).update(is_read=True, read_at=now, updated_at=now)
    record_audit_event(
        user=actor,
        action="NOTIFICATIONS_MARKED_ALL_READ",
        entity_type="Notification",
        entity_id=actor.pk,
        new_data={"updated": updated},
        request=request,
    )
    return updated


def staff_for_appointment(appointment: Appointment):
    recipients = {appointment.primary_staff}
    recipients.update(staff.user for staff in appointment.staff_members.select_related("user").all())
    return {user for user in recipients if user and user.is_active}


def generate_appointment_reminders(now) -> int:
    window_end = now + timezone.timedelta(hours=settings.APPOINTMENT_REMINDER_HOURS)
    appointments = (
        Appointment.objects.select_related("patient", "primary_staff")
        .prefetch_related("staff_members", "staff_members__user")
        .filter(start_at__gte=now, start_at__lte=window_end)
        .exclude(status__in=[Appointment.Status.CANCELLED, Appointment.Status.COMPLETED, Appointment.Status.NO_SHOW])
    )
    created = 0
    for appointment in appointments:
        for recipient in staff_for_appointment(appointment):
            notification = create_notification(
                recipient=recipient,
                notification_type=Notification.Type.APPOINTMENT,
                priority=Notification.Priority.NORMAL,
                title="Upcoming appointment",
                message=f"Upcoming appointment for patient {appointment.patient.patient_reference}.",
                patient=appointment.patient,
                appointment=appointment,
                deduplication_key=f"appointment:{appointment.pk}:reminder:{recipient.pk}",
            )
            created += int(notification is not None)
    return created


def generate_surgery_reminders(now) -> int:
    window_end = now + timezone.timedelta(hours=settings.SURGERY_REMINDER_HOURS)
    surgeries = Surgery.objects.select_related("patient", "surgeon").filter(
        planned_date__gte=now,
        planned_date__lte=window_end,
    ).exclude(status__in=[Surgery.Status.COMPLETED, Surgery.Status.CANCELLED])
    created = 0
    for surgery in surgeries:
        notification = create_notification(
            recipient=surgery.surgeon,
            notification_type=Notification.Type.SURGERY,
            priority=Notification.Priority.HIGH,
            title="Upcoming surgery",
            message=f"Upcoming surgery for patient {surgery.patient.patient_reference}.",
            patient=surgery.patient,
            surgery=surgery,
            deduplication_key=f"surgery:{surgery.pk}:reminder:{surgery.surgeon_id}",
        )
        created += int(notification is not None)
    return created


def surgery_needs_preop_attention(surgery: Surgery) -> bool:
    try:
        validate_surgery_readiness(surgery)
    except ValidationError:
        return True
    return False


def generate_preop_alerts(now) -> int:
    window_end = now + timezone.timedelta(hours=settings.PREOP_ALERT_HOURS)
    surgeries = Surgery.objects.select_related("patient", "surgeon").filter(
        planned_date__gte=now,
        planned_date__lte=window_end,
        status__in=[Surgery.Status.PLANNED, Surgery.Status.PREOP_IN_PROGRESS, Surgery.Status.READY],
    )
    created = 0
    for surgery in surgeries:
        if not surgery_needs_preop_attention(surgery):
            continue
        notification = create_notification(
            recipient=surgery.surgeon,
            notification_type=Notification.Type.PREOPERATIVE,
            priority=Notification.Priority.HIGH,
            title="Pre-operative attention needed",
            message=f"Pre-operative readiness needs attention for patient {surgery.patient.patient_reference}.",
            patient=surgery.patient,
            surgery=surgery,
            deduplication_key=f"preop:{surgery.pk}:attention:{surgery.surgeon_id}",
        )
        created += int(notification is not None)
    return created


def generate_care_reminders(now) -> int:
    window_end = now + timezone.timedelta(hours=settings.APPOINTMENT_REMINDER_HOURS)
    sessions = (
        CareSession.objects.select_related("care", "care__patient", "nurse")
        .filter(scheduled_at__gte=now, scheduled_at__lte=window_end)
        .exclude(status__in=[CareSession.Status.COMPLETED, CareSession.Status.CANCELLED])
    )
    created = 0
    for session in sessions:
        notification = create_notification(
            recipient=session.nurse,
            notification_type=Notification.Type.CARE,
            priority=Notification.Priority.NORMAL,
            title="Upcoming care session",
            message=f"Upcoming care session for patient {session.care.patient.patient_reference}.",
            patient=session.care.patient,
            care=session.care,
            care_session=session,
            deduplication_key=f"care-session:{session.pk}:reminder:{session.nurse_id}",
        )
        created += int(notification is not None)
    return created


def billing_recipients():
    return User.objects.filter(is_active=True, role__in=[User.Role.ADMIN, User.Role.SECRETARY])


def generate_billing_alerts(now) -> int:
    invoices = Invoice.objects.select_related("patient").filter(
        due_date__lt=timezone.localdate(),
        status__in=[Invoice.Status.ISSUED, Invoice.Status.PARTIALLY_PAID],
    )
    created = 0
    for invoice in invoices:
        if not invoice.is_overdue:
            continue
        for recipient in billing_recipients():
            notification = create_notification(
                recipient=recipient,
                notification_type=Notification.Type.BILLING,
                priority=Notification.Priority.HIGH,
                title="Overdue invoice",
                message=f"Invoice {invoice.invoice_number or invoice.pk} is overdue.",
                patient=invoice.patient,
                invoice=invoice,
                deduplication_key=f"invoice:{invoice.pk}:overdue:{recipient.pk}",
            )
            created += int(notification is not None)
    return created


def generate_due_reminders(now=None) -> dict:
    now = now or timezone.now()
    result = ReminderResult(
        appointments_created=generate_appointment_reminders(now),
        surgeries_created=generate_surgery_reminders(now),
        preop_created=generate_preop_alerts(now),
        care_created=generate_care_reminders(now),
        billing_created=generate_billing_alerts(now),
    )
    return result.as_dict()


def notification_counts_by_type(user):
    return Counter(Notification.objects.filter(recipient=user, is_read=False).values_list("notification_type", flat=True))
