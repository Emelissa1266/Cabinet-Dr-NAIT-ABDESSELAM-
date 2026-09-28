from decimal import Decimal

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework import status

from apps.agenda.models import Appointment, AppointmentStaff, AppointmentType
from apps.audit.models import AuditLog
from apps.billing.models import BillableService, Invoice, InvoiceItem
from apps.care.models import Care, CareCategory, CareSession, CareType
from apps.notifications.models import Notification
from apps.notifications.services import generate_due_reminders
from apps.payments.models import Payment
from apps.surgery.models import PreoperativeRequirement, Surgery

pytestmark = pytest.mark.django_db


@pytest.fixture
def patient(secretary_user):
    from apps.patients.models import Patient

    return Patient.objects.create(first_name="Phase", last_name="Eight", created_by=secretary_user)


@pytest.fixture
def appointment_type():
    return AppointmentType.objects.create(
        name="Consultation",
        code="phase8-consultation",
        default_duration_minutes=30,
        requires_doctor=True,
    )


@pytest.fixture
def care_type():
    category = CareCategory.objects.create(name="Phase 8 care")
    return CareType.objects.create(category=category, name="Dressing")


def create_invoice(patient, secretary_user, *, status_value=Invoice.Status.ISSUED, due_date=None, amount="1000.00"):
    service = BillableService.objects.create(
        code=f"svc-{Invoice.objects.count()}",
        name="Service",
        default_unit_price=Decimal(amount),
    )
    invoice = Invoice.objects.create(
        patient=patient,
        invoice_number=f"INV-TEST-{Invoice.objects.count()}",
        due_date=due_date,
        created_by=secretary_user,
    )
    InvoiceItem.objects.create(
        invoice=invoice,
        billable_service=service,
        description="Service",
        quantity=Decimal("1.00"),
        unit_price=Decimal(amount),
    )
    invoice.status = status_value
    invoice.save(update_fields=["status", "updated_at"])
    return invoice


def test_notification_ownership_read_state_and_unread_count(api_client, doctor_user, nurse_user):
    own = Notification.objects.create(
        recipient=doctor_user,
        notification_type=Notification.Type.SYSTEM,
        title="Own",
        message="Own notification",
    )
    Notification.objects.create(
        recipient=doctor_user,
        notification_type=Notification.Type.SYSTEM,
        title="Read",
        message="Read notification",
        is_read=True,
        read_at=timezone.now(),
    )
    other = Notification.objects.create(
        recipient=nurse_user,
        notification_type=Notification.Type.SYSTEM,
        title="Other",
        message="Other notification",
    )

    api_client.force_authenticate(user=doctor_user)
    listed = api_client.get("/api/v1/notifications/")
    unread = api_client.get("/api/v1/notifications/unread-count/")
    read = api_client.post(f"/api/v1/notifications/{own.id}/mark-read/")
    unread_again = api_client.post(f"/api/v1/notifications/{own.id}/mark-unread/")
    denied = api_client.post(f"/api/v1/notifications/{other.id}/mark-read/")
    all_read = api_client.post("/api/v1/notifications/mark-all-read/")
    other.refresh_from_db()

    assert listed.data["count"] == 2
    assert unread.data["unread_count"] == 1
    assert read.data["is_read"] is True
    assert read.data["read_at"] is not None
    assert unread_again.data["is_read"] is False
    assert unread_again.data["read_at"] is None
    assert denied.status_code == status.HTTP_404_NOT_FOUND
    assert all_read.data["updated"] == 1
    assert other.is_read is False
    assert AuditLog.objects.filter(action="NOTIFICATION_MARKED_READ").exists()
    assert AuditLog.objects.filter(action="NOTIFICATIONS_MARKED_ALL_READ").exists()


def test_reminder_generation_is_idempotent_and_observes_domain_state(
    admin_user,
    doctor_user,
    nurse_user,
    secretary_user,
    patient,
    appointment_type,
    care_type,
):
    now = timezone.now()
    appointment = Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=now + timezone.timedelta(hours=2),
        end_at=now + timezone.timedelta(hours=3),
    )
    AppointmentStaff.objects.create(appointment=appointment, user=nurse_user)
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=now + timezone.timedelta(days=3),
        end_at=now + timezone.timedelta(days=3, hours=1),
    )
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=now + timezone.timedelta(hours=4),
        end_at=now + timezone.timedelta(hours=5),
        status=Appointment.Status.CANCELLED,
    )
    surgery = Surgery.objects.create(
        patient=patient,
        surgeon=doctor_user,
        procedure_name="Procedure",
        indication="Indication",
        planned_date=now + timezone.timedelta(hours=20),
        status=Surgery.Status.PLANNED,
    )
    PreoperativeRequirement.objects.create(surgery=surgery, name="Lab", required=True)
    care = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=nurse_user,
        start_date=timezone.localdate(),
        planned_sessions=1,
    )
    session = CareSession.objects.create(care=care, nurse=nurse_user, scheduled_at=now + timezone.timedelta(hours=3))
    invoice = create_invoice(
        patient,
        secretary_user,
        due_date=timezone.localdate() - timezone.timedelta(days=1),
        amount="1200.00",
    )
    before_statuses = (appointment.status, surgery.status, session.status, invoice.status)

    first = generate_due_reminders(now=now)
    second = generate_due_reminders(now=now)
    appointment.refresh_from_db()
    surgery.refresh_from_db()
    session.refresh_from_db()
    invoice.refresh_from_db()

    assert first["total_created"] == 7
    assert first["appointments_created"] == 2
    assert first["surgeries_created"] == 1
    assert first["preop_created"] == 1
    assert first["care_created"] == 1
    assert first["billing_created"] == 2
    assert second["total_created"] == 0
    assert Notification.objects.count() == 7
    assert (appointment.status, surgery.status, session.status, invoice.status) == before_statuses


def test_generate_reminders_management_command_is_idempotent(capsys, doctor_user, patient, appointment_type):
    now = timezone.now()
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=now + timezone.timedelta(hours=1),
        end_at=now + timezone.timedelta(hours=2),
    )

    call_command("generate_reminders")
    call_command("generate_reminders")
    output = capsys.readouterr().out

    assert "Generated reminders" in output
    assert Notification.objects.filter(notification_type=Notification.Type.APPOINTMENT).count() == 1


def test_billing_alerts_ignore_paid_and_cancelled_invoices(secretary_user, admin_user, patient):
    overdue = create_invoice(
        patient,
        secretary_user,
        due_date=timezone.localdate() - timezone.timedelta(days=1),
        amount="2000.00",
    )
    paid = create_invoice(
        patient,
        secretary_user,
        status_value=Invoice.Status.PAID,
        due_date=timezone.localdate() - timezone.timedelta(days=1),
        amount="1000.00",
    )
    cancelled = create_invoice(
        patient,
        secretary_user,
        status_value=Invoice.Status.CANCELLED,
        due_date=timezone.localdate() - timezone.timedelta(days=1),
        amount="1000.00",
    )
    Payment.objects.create(
        patient=patient,
        amount=Decimal("1000.00"),
        payment_method=Payment.Method.CASH,
        status=Payment.Status.COMPLETED,
        received_by=secretary_user,
    )

    result = generate_due_reminders(now=timezone.now())

    assert result["billing_created"] == 2
    assert set(Notification.objects.values_list("recipient", flat=True)) == {secretary_user.id, admin_user.id}
    assert Notification.objects.filter(invoice=overdue).count() == 2
    assert Notification.objects.filter(invoice=paid).count() == 0
    assert Notification.objects.filter(invoice=cancelled).count() == 0
    assert overdue.remaining_amount == Decimal("2000.00")
