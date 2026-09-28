from decimal import Decimal

import pytest
from django.utils import timezone

from apps.agenda.models import Appointment, AppointmentType
from apps.billing.models import BillableService, Invoice, InvoiceItem
from apps.care.models import Care, CareCategory, CareSession, CareType
from apps.notifications.models import Notification
from apps.payments.models import Payment
from apps.surgery.models import PostoperativeFollowUp, PreoperativeRequirement, Surgery

pytestmark = pytest.mark.django_db


@pytest.fixture
def patient(secretary_user):
    from apps.patients.models import Patient

    return Patient.objects.create(first_name="Dash", last_name="Patient", created_by=secretary_user)


@pytest.fixture
def appointment_type():
    return AppointmentType.objects.create(name="Dashboard consultation", code="dash-consult", default_duration_minutes=30)


@pytest.fixture
def care_type():
    category = CareCategory.objects.create(name="Dashboard care")
    return CareType.objects.create(category=category, name="Dressing")


def create_invoice(patient, secretary_user, due_date, amount="1000.00"):
    service = BillableService.objects.create(code=f"dash-{Invoice.objects.count()}", name="Service", default_unit_price=amount)
    invoice = Invoice.objects.create(
        patient=patient,
        invoice_number=f"INV-DASH-{Invoice.objects.count()}",
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
    invoice.status = Invoice.Status.ISSUED
    invoice.save(update_fields=["status", "updated_at"])
    return invoice


def test_dashboard_role_payloads_and_role_spoofing_ignored(
    api_client,
    admin_user,
    doctor_user,
    nurse_user,
    secretary_user,
    patient,
    appointment_type,
    care_type,
):
    today = timezone.localdate()
    start = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time())) + timezone.timedelta(hours=9)
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=start,
        end_at=start + timezone.timedelta(minutes=30),
    )
    surgery = Surgery.objects.create(
        patient=patient,
        surgeon=doctor_user,
        procedure_name="Procedure",
        indication="Indication",
        planned_date=start + timezone.timedelta(days=1),
        status=Surgery.Status.PLANNED,
        notes="sensitive operative note",
    )
    PreoperativeRequirement.objects.create(surgery=surgery, name="Lab", required=True)
    PostoperativeFollowUp.objects.create(
        surgery=surgery,
        patient=patient,
        doctor=doctor_user,
        follow_up_date=start + timezone.timedelta(days=2),
        recovery_status="Improving",
    )
    care = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=nurse_user,
        start_date=today,
        planned_sessions=1,
    )
    CareSession.objects.create(care=care, nurse=nurse_user, scheduled_at=start, status=CareSession.Status.IN_PROGRESS)
    create_invoice(patient, secretary_user, today - timezone.timedelta(days=1), amount="5000.00")
    Payment.objects.create(
        patient=patient,
        amount=Decimal("1500.00"),
        payment_method=Payment.Method.CASH,
        status=Payment.Status.COMPLETED,
        paid_at=start,
        received_by=secretary_user,
    )
    for user in (admin_user, doctor_user, nurse_user, secretary_user):
        Notification.objects.create(
            recipient=user,
            notification_type=Notification.Type.SYSTEM,
            title="Unread",
            message="Unread notification",
        )

    api_client.force_authenticate(user=doctor_user)
    doctor = api_client.get("/api/v1/dashboard/?role=ADMIN")
    api_client.force_authenticate(user=nurse_user)
    nurse = api_client.get("/api/v1/dashboard/?role=ADMIN")
    api_client.force_authenticate(user=secretary_user)
    secretary = api_client.get("/api/v1/dashboard/")
    api_client.force_authenticate(user=admin_user)
    admin = api_client.get("/api/v1/dashboard/")

    assert doctor.data["role"] == "DOCTOR"
    assert doctor.data["today"]["appointments_count"] == 1
    assert doctor.data["pending"]["preop_attention_count"] == 1
    assert doctor.data["upcoming"]["postoperative_followups_count"] == 1
    assert "sensitive operative note" not in str(doctor.data)

    assert nurse.data["role"] == "NURSE"
    assert nurse.data["today"]["assigned_sessions_count"] == 1
    assert nurse.data["pending"]["in_progress_sessions_count"] == 1
    assert "financial" not in nurse.data

    assert secretary.data["role"] == "SECRETARY"
    assert secretary.data["today"]["appointments_count"] == 1
    assert secretary.data["financial"]["overdue_invoices_count"] == 1
    assert secretary.data["financial"]["paid_today"] == "1500.00"

    assert admin.data["role"] == "ADMIN"
    assert admin.data["today"]["appointments_count"] == 1
    assert admin.data["financial"]["outstanding_amount"] == "5000.00"
    assert admin.data["statistics"]["notifications_unread_count"] == 1
