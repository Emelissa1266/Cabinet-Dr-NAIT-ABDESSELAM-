from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import User
from apps.agenda.models import Appointment, AppointmentStaff, AppointmentType
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


def at(day, hour, minute=0):
    return timezone.make_aware(timezone.datetime.combine(day, timezone.datetime.min.time())) + timezone.timedelta(hours=hour, minutes=minute)


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


def get_dashboard(api_client, user):
    api_client.force_authenticate(user=user)
    response = api_client.get("/api/v1/dashboard/?role=ADMIN")
    assert response.status_code == status.HTTP_200_OK
    return response.data


def test_dashboard_endpoint_requires_authentication(api_client):
    response = api_client.get("/api/v1/dashboard/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_doctor_dashboard_counts_assigned_appointments_and_excludes_other_doctors(
    api_client,
    make_user,
    doctor_user,
    secretary_user,
    patient,
    appointment_type,
    care_type,
):
    other_doctor = make_user(role=User.Role.DOCTOR, username="other-doctor")
    today = timezone.localdate()
    now = timezone.now()
    today_start = at(today, 10)
    tomorrow = now + timezone.timedelta(days=1)
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=today_start,
        end_at=today_start + timezone.timedelta(minutes=30),
    )
    upcoming = Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=secretary_user,
        start_at=tomorrow,
        end_at=tomorrow + timezone.timedelta(minutes=30),
    )
    AppointmentStaff.objects.create(appointment=upcoming, user=doctor_user, role="Consultant")
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=other_doctor,
        start_at=today_start,
        end_at=today_start + timezone.timedelta(minutes=30),
    )
    cancelled = Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=today_start + timezone.timedelta(hours=1),
        end_at=today_start + timezone.timedelta(hours=1, minutes=30),
        status=Appointment.Status.CANCELLED,
    )
    surgery = Surgery.objects.create(
        patient=patient,
        surgeon=doctor_user,
        procedure_name="Procedure",
        indication="Indication",
        planned_date=tomorrow,
        status=Surgery.Status.PLANNED,
        notes="sensitive operative note",
    )
    PreoperativeRequirement.objects.create(surgery=surgery, name="Lab", required=True)
    PostoperativeFollowUp.objects.create(
        surgery=surgery,
        patient=patient,
        doctor=doctor_user,
        follow_up_date=tomorrow + timezone.timedelta(days=1),
        recovery_status="Improving",
    )
    Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        start_date=today,
        planned_sessions=1,
    )

    data = get_dashboard(api_client, doctor_user)
    assert data["role"] == "DOCTOR"
    assert data["today"]["appointments_count"] == 1
    assert data["upcoming"]["appointments_count"] == 1
    assert data["upcoming"]["surgeries_count"] == 1
    assert data["pending"]["preop_attention_count"] == 1
    assert data["upcoming"]["postoperative_followups_count"] == 1
    assert data["pending"]["active_care_count"] == 1
    assert data["upcoming"]["appointments"][0]["patient_name"] == "Dash Patient"
    appointment_ids = {appointment["id"] for appointment in data["today"]["appointments"] + data["upcoming"]["appointments"]}
    assert cancelled.id not in appointment_ids
    assert "sensitive operative note" not in str(data)


def test_nurse_dashboard_distinguishes_agenda_appointments_from_care_sessions(
    api_client,
    make_user,
    doctor_user,
    nurse_user,
    secretary_user,
    patient,
    appointment_type,
    care_type,
):
    other_nurse = make_user(role=User.Role.NURSE, username="other-nurse")
    today = timezone.localdate()
    now = timezone.now()
    today_start = at(today, 11)
    tomorrow = now + timezone.timedelta(days=1)
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=today_start,
        end_at=today_start + timezone.timedelta(minutes=30),
    )
    nurse_appointment = Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=nurse_user,
        start_at=today_start + timezone.timedelta(hours=1),
        end_at=today_start + timezone.timedelta(hours=1, minutes=30),
    )
    participant_appointment = Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=secretary_user,
        start_at=tomorrow,
        end_at=tomorrow + timezone.timedelta(minutes=30),
    )
    AppointmentStaff.objects.create(appointment=participant_appointment, user=nurse_user, role="Assistant")
    care = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=nurse_user,
        start_date=today,
        planned_sessions=3,
    )
    CareSession.objects.create(care=care, nurse=nurse_user, scheduled_at=today_start, status=CareSession.Status.PLANNED)
    CareSession.objects.create(care=care, nurse=nurse_user, scheduled_at=today_start, status=CareSession.Status.IN_PROGRESS)
    CareSession.objects.create(
        care=care,
        nurse=nurse_user,
        scheduled_at=today_start,
        completed_at=now,
        status=CareSession.Status.COMPLETED,
    )
    CareSession.objects.create(care=care, nurse=nurse_user, scheduled_at=tomorrow, status=CareSession.Status.PLANNED)
    other_care = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=other_nurse,
        start_date=today,
        planned_sessions=1,
    )
    CareSession.objects.create(care=other_care, nurse=other_nurse, scheduled_at=today_start, status=CareSession.Status.PLANNED)

    data = get_dashboard(api_client, nurse_user)
    assert data["role"] == "NURSE"
    assert data["today"]["appointments_count"] == 1
    assert data["upcoming"]["appointments_count"] == 1
    assert data["today"]["planned_sessions_count"] == 2
    assert data["today"]["completed_sessions_count"] == 1
    assert data["pending"]["in_progress_sessions_count"] == 1
    assert data["pending"]["assigned_care_count"] == 1
    assert data["upcoming"]["care_sessions_count"] == 1
    assert data["today"]["appointments"][0]["id"] == nurse_appointment.id
    assert data["upcoming"]["care_sessions"][0]["care_type_name"] == "Dressing"


def test_secretary_dashboard_uses_clinic_agenda_and_billing_without_clinical_details(
    api_client,
    doctor_user,
    secretary_user,
    patient,
    appointment_type,
):
    today = timezone.localdate()
    now = timezone.now()
    start = at(today, 9)
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=start,
        end_at=start + timezone.timedelta(minutes=30),
        status=Appointment.Status.CHECKED_IN,
    )
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=start + timezone.timedelta(hours=1),
        end_at=start + timezone.timedelta(hours=1, minutes=30),
        status=Appointment.Status.CANCELLED,
    )
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=now + timezone.timedelta(days=1),
        end_at=now + timezone.timedelta(days=1, minutes=30),
    )
    create_invoice(patient, secretary_user, today - timezone.timedelta(days=1), amount="5000.00")
    Payment.objects.create(
        patient=patient,
        amount=Decimal("1500.00"),
        payment_method=Payment.Method.CASH,
        status=Payment.Status.COMPLETED,
        paid_at=now,
        received_by=secretary_user,
    )
    Notification.objects.create(recipient=secretary_user, notification_type=Notification.Type.SYSTEM, title="Unread", message="Unread")

    data = get_dashboard(api_client, secretary_user)
    assert data["role"] == "SECRETARY"
    assert data["today"]["appointments_count"] == 1
    assert data["today"]["patients_scheduled_count"] == 1
    assert data["today"]["checked_in_count"] == 1
    assert data["pending"]["cancelled_count"] == 1
    assert data["upcoming"]["appointments_count"] == 1
    assert data["financial"]["overdue_invoices_count"] == 1
    assert data["financial"]["outstanding_amount"] == "5000.00"
    assert data["financial"]["paid_today"] == "1500.00"
    assert data["statistics"]["unread_notifications_count"] == 1
    assert "diagnosis" not in str(data).lower()


def test_admin_dashboard_matches_clinic_truth(api_client, admin_user, doctor_user, secretary_user, patient, appointment_type):
    today = timezone.localdate()
    now = timezone.now()
    Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=doctor_user,
        start_at=at(today, 9),
        end_at=at(today, 9, 30),
    )
    Surgery.objects.create(
        patient=patient,
        surgeon=doctor_user,
        procedure_name="Procedure",
        indication="Indication",
        planned_date=now + timezone.timedelta(days=1),
        status=Surgery.Status.PLANNED,
    )
    create_invoice(patient, secretary_user, today - timezone.timedelta(days=1), amount="7000.00")
    Notification.objects.create(recipient=admin_user, notification_type=Notification.Type.SYSTEM, title="Unread", message="Unread")

    data = get_dashboard(api_client, admin_user)
    assert data["role"] == "ADMIN"
    assert data["today"]["appointments_count"] == 1
    assert data["upcoming"]["surgeries_count"] == 1
    assert data["financial"]["outstanding_amount"] == "7000.00"
    assert data["statistics"]["active_users_count"] == User.objects.filter(is_active=True).count()
    assert data["statistics"]["notifications_unread_count"] == 1


def test_unread_notifications_are_user_scoped(api_client, doctor_user, nurse_user):
    Notification.objects.create(recipient=doctor_user, notification_type=Notification.Type.SYSTEM, title="Doctor", message="Doctor")
    Notification.objects.create(recipient=nurse_user, notification_type=Notification.Type.SYSTEM, title="Nurse", message="Nurse")
    Notification.objects.create(recipient=nurse_user, notification_type=Notification.Type.SYSTEM, title="Read", message="Read", is_read=True)
    doctor = get_dashboard(api_client, doctor_user)
    nurse = get_dashboard(api_client, nurse_user)
    assert doctor["statistics"]["unread_notifications_count"] == 1
    assert nurse["statistics"]["unread_notifications_count"] == 1
