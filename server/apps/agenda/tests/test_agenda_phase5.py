from datetime import time, timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from apps.agenda.models import (
    Appointment,
    AppointmentReschedule,
    AppointmentStaff,
    AppointmentType,
    ClinicClosure,
    StaffTimeOff,
    StaffWorkingHours,
)
from apps.audit.models import AuditLog
from apps.care.models import Care, CareCategory, CareSession, CareType
from apps.medical.models import Consultation
from apps.patients.models import Patient
from apps.surgery.models import Surgery


def aware_at(day, hour, minute=0):
    return timezone.make_aware(timezone.datetime.combine(day, time(hour, minute)))


@pytest.fixture
def patient(db, doctor_user):
    return Patient.objects.create(first_name="Agenda", last_name="Patient", created_by=doctor_user)


@pytest.fixture
def base_day():
    return timezone.localdate() + timedelta(days=7)


@pytest.fixture
def consultation_type(db):
    return AppointmentType.objects.create(
        name="Initial consultation",
        code="initial-consultation",
        category=AppointmentType.Category.CONSULTATION,
        default_duration_minutes=30,
        requires_doctor=True,
    )


@pytest.fixture
def nurse_type(db):
    return AppointmentType.objects.create(
        name="Dressing change",
        code="dressing-change",
        category=AppointmentType.Category.NURSING_CARE,
        default_duration_minutes=45,
        requires_nurse=True,
    )


@pytest.fixture
def working_hours(doctor_user, nurse_user, base_day):
    for staff in (doctor_user, nurse_user):
        StaffWorkingHours.objects.create(
            staff=staff,
            weekday=base_day.weekday(),
            start_time=time(8, 0),
            end_time=time(17, 0),
        )


@pytest.fixture
def appointment(api_client, secretary_user, doctor_user, patient, consultation_type, working_hours, base_day):
    api_client.force_authenticate(user=secretary_user)
    response = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 9).isoformat(),
            "reason": "Consultation",
        },
        format="json",
    )
    return Appointment.objects.get(pk=response.data["id"])


@pytest.mark.django_db
def test_secretary_creates_appointment_with_default_and_explicit_duration(
    api_client,
    secretary_user,
    doctor_user,
    patient,
    consultation_type,
    working_hours,
    base_day,
):
    api_client.force_authenticate(user=secretary_user)
    default_duration = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 9).isoformat(),
            "reason": "Default duration",
        },
        format="json",
    )
    explicit_duration = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 10).isoformat(),
            "end_at": aware_at(base_day, 11).isoformat(),
            "reason": "Explicit duration",
        },
        format="json",
    )

    assert default_duration.status_code == status.HTTP_201_CREATED
    assert default_duration.data["end_at"].startswith(aware_at(base_day, 9, 30).isoformat().replace("+00:00", "Z")[:16])
    assert explicit_duration.status_code == status.HTTP_201_CREATED
    assert Appointment.objects.count() == 2
    assert AuditLog.objects.filter(action="APPOINTMENT_CREATED").count() == 2


@pytest.mark.django_db
def test_invalid_duration_inactive_type_and_role_requirements(
    api_client,
    secretary_user,
    doctor_user,
    nurse_user,
    patient,
    consultation_type,
    nurse_type,
    working_hours,
    base_day,
):
    consultation_type.is_active = False
    consultation_type.save(update_fields=["is_active"])
    api_client.force_authenticate(user=secretary_user)
    inactive = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 9).isoformat(),
        },
        format="json",
    )
    consultation_type.is_active = True
    consultation_type.save(update_fields=["is_active"])
    invalid_duration = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 10).isoformat(),
            "end_at": aware_at(base_day, 10).isoformat(),
        },
        format="json",
    )
    wrong_role = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": nurse_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 11).isoformat(),
        },
        format="json",
    )
    right_role = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": nurse_type.id,
            "primary_staff": nurse_user.id,
            "start_at": aware_at(base_day, 11).isoformat(),
        },
        format="json",
    )

    assert inactive.status_code == status.HTTP_400_BAD_REQUEST
    assert invalid_duration.status_code == status.HTTP_400_BAD_REQUEST
    assert wrong_role.status_code == status.HTTP_400_BAD_REQUEST
    assert right_role.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_conflict_detection_primary_staff_and_back_to_back(
    api_client,
    secretary_user,
    doctor_user,
    patient,
    consultation_type,
    working_hours,
    base_day,
):
    api_client.force_authenticate(user=secretary_user)
    payload = {
        "patient": patient.id,
        "appointment_type": consultation_type.id,
        "primary_staff": doctor_user.id,
        "start_at": aware_at(base_day, 9).isoformat(),
        "end_at": aware_at(base_day, 10).isoformat(),
    }
    assert api_client.post("/api/v1/appointments/", payload, format="json").status_code == status.HTTP_201_CREATED
    overlapping = api_client.post(
        "/api/v1/appointments/",
        {**payload, "start_at": aware_at(base_day, 9, 30).isoformat(), "end_at": aware_at(base_day, 10, 30).isoformat()},
        format="json",
    )
    before = api_client.post(
        "/api/v1/appointments/",
        {**payload, "start_at": aware_at(base_day, 8).isoformat(), "end_at": aware_at(base_day, 9).isoformat()},
        format="json",
    )
    after = api_client.post(
        "/api/v1/appointments/",
        {**payload, "start_at": aware_at(base_day, 10).isoformat(), "end_at": aware_at(base_day, 11).isoformat()},
        format="json",
    )
    assert overlapping.status_code == status.HTTP_400_BAD_REQUEST
    assert before.status_code == status.HTTP_201_CREATED
    assert after.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_conflict_detection_secondary_staff_and_cancelled_slot_reuse(
    api_client,
    secretary_user,
    doctor_user,
    nurse_user,
    patient,
    consultation_type,
    working_hours,
    base_day,
):
    api_client.force_authenticate(user=secretary_user)
    first = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 9).isoformat(),
            "end_at": aware_at(base_day, 10).isoformat(),
            "staff_members": [{"user": nurse_user.id, "role": "Assistant"}],
        },
        format="json",
    )
    conflict = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": nurse_user.id,
            "start_at": aware_at(base_day, 9, 30).isoformat(),
            "end_at": aware_at(base_day, 10, 30).isoformat(),
        },
        format="json",
    )
    cancel = api_client.post(
        f"/api/v1/appointments/{first.data['id']}/cancel/",
        {"reason": "Patient cancelled"},
        format="json",
    )
    reused = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 9, 30).isoformat(),
            "end_at": aware_at(base_day, 10, 30).isoformat(),
        },
        format="json",
    )
    assert conflict.status_code == status.HTTP_400_BAD_REQUEST
    assert cancel.status_code == status.HTTP_200_OK
    assert reused.status_code == status.HTTP_201_CREATED
    assert AppointmentStaff.objects.count() == 1


@pytest.mark.django_db
def test_availability_accounts_for_hours_time_off_closure_and_existing_appointments(
    api_client,
    admin_user,
    secretary_user,
    doctor_user,
    patient,
    consultation_type,
    working_hours,
    base_day,
):
    ClinicClosure.objects.create(start_at=aware_at(base_day, 12), end_at=aware_at(base_day, 13), reason="Maintenance")
    StaffTimeOff.objects.create(staff=doctor_user, start_at=aware_at(base_day, 15), end_at=aware_at(base_day, 16), reason="PERSONAL")
    api_client.force_authenticate(user=secretary_user)
    api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 9).isoformat(),
            "end_at": aware_at(base_day, 10).isoformat(),
        },
        format="json",
    )
    response = api_client.get(
        f"/api/v1/availability/?staff={doctor_user.id}&appointment_type={consultation_type.id}&date={base_day.isoformat()}&duration_minutes=60"
    )
    starts = {item["start_at"][11:16] for item in response.data}
    assert response.status_code == status.HTTP_200_OK
    assert "08:00" in starts
    assert "09:00" not in starts
    assert "12:00" not in starts
    assert "15:00" not in starts
    assert "10:00" in starts


@pytest.mark.django_db
def test_state_machine_valid_and_invalid_transitions(api_client, secretary_user, appointment):
    api_client.force_authenticate(user=secretary_user)
    direct_complete = api_client.post(f"/api/v1/appointments/{appointment.id}/complete/")
    appointment.refresh_from_db()
    assert direct_complete.status_code == status.HTTP_400_BAD_REQUEST
    assert appointment.status == Appointment.Status.SCHEDULED

    assert api_client.post(f"/api/v1/appointments/{appointment.id}/confirm/").data["status"] == "CONFIRMED"
    assert api_client.post(f"/api/v1/appointments/{appointment.id}/check-in/").data["status"] == "CHECKED_IN"
    assert api_client.post(f"/api/v1/appointments/{appointment.id}/start/").data["status"] == "IN_PROGRESS"
    completed = api_client.post(f"/api/v1/appointments/{appointment.id}/complete/")
    assert completed.data["status"] == "COMPLETED"
    cancelled = api_client.post(f"/api/v1/appointments/{appointment.id}/cancel/", {"reason": "Too late"}, format="json")
    appointment.refresh_from_db()
    assert cancelled.status_code == status.HTTP_400_BAD_REQUEST
    assert appointment.status == Appointment.Status.COMPLETED


@pytest.mark.django_db
def test_no_show_and_cancel_behaviour(api_client, secretary_user, appointment):
    api_client.force_authenticate(user=secretary_user)
    no_show = api_client.post(f"/api/v1/appointments/{appointment.id}/no-show/")
    restart = api_client.post(f"/api/v1/appointments/{appointment.id}/start/")
    appointment.refresh_from_db()
    assert no_show.status_code == status.HTTP_200_OK
    assert appointment.status == Appointment.Status.NO_SHOW
    assert appointment.no_show_at is not None
    assert restart.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_reschedule_success_history_and_failure_preserves_state(
    api_client,
    secretary_user,
    doctor_user,
    patient,
    consultation_type,
    working_hours,
    base_day,
    appointment,
):
    api_client.force_authenticate(user=secretary_user)
    old_start = appointment.start_at
    old_end = appointment.end_at
    success = api_client.post(
        f"/api/v1/appointments/{appointment.id}/reschedule/",
        {"new_start_at": aware_at(base_day, 11).isoformat(), "reason": "Patient request"},
        format="json",
    )
    appointment.refresh_from_db()
    assert success.status_code == status.HTTP_200_OK
    assert appointment.start_at == aware_at(base_day, 11)
    history = AppointmentReschedule.objects.get(appointment=appointment)
    assert history.old_start_at == old_start
    assert history.old_end_at == old_end

    api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 12).isoformat(),
            "end_at": aware_at(base_day, 13).isoformat(),
        },
        format="json",
    )
    before = appointment.start_at
    conflict = api_client.post(
        f"/api/v1/appointments/{appointment.id}/reschedule/",
        {"new_start_at": aware_at(base_day, 12, 15).isoformat()},
        format="json",
    )
    appointment.refresh_from_db()
    assert conflict.status_code == status.HTTP_400_BAD_REQUEST
    assert appointment.start_at == before


@pytest.mark.django_db
def test_reschedule_blocked_for_completed_cancelled_timeoff_and_closure(
    api_client,
    secretary_user,
    doctor_user,
    appointment,
    base_day,
):
    api_client.force_authenticate(user=secretary_user)
    ClinicClosure.objects.create(start_at=aware_at(base_day, 14), end_at=aware_at(base_day, 15), reason="Closure")
    closure = api_client.post(
        f"/api/v1/appointments/{appointment.id}/reschedule/",
        {"new_start_at": aware_at(base_day, 14).isoformat()},
        format="json",
    )
    StaffTimeOff.objects.create(staff=doctor_user, start_at=aware_at(base_day, 15), end_at=aware_at(base_day, 16), reason="LEAVE")
    timeoff = api_client.post(
        f"/api/v1/appointments/{appointment.id}/reschedule/",
        {"new_start_at": aware_at(base_day, 15).isoformat()},
        format="json",
    )
    api_client.post(f"/api/v1/appointments/{appointment.id}/confirm/")
    api_client.post(f"/api/v1/appointments/{appointment.id}/check-in/")
    api_client.post(f"/api/v1/appointments/{appointment.id}/start/")
    api_client.post(f"/api/v1/appointments/{appointment.id}/complete/")
    completed = api_client.post(
        f"/api/v1/appointments/{appointment.id}/reschedule/",
        {"new_start_at": aware_at(base_day, 16).isoformat()},
        format="json",
    )
    assert closure.status_code == status.HTTP_400_BAD_REQUEST
    assert timeoff.status_code == status.HTTP_400_BAD_REQUEST
    assert completed.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_clinical_links_consistency_and_completion_does_not_change_clinical_state(
    api_client,
    secretary_user,
    doctor_user,
    nurse_user,
    patient,
    consultation_type,
    working_hours,
    base_day,
):
    consultation = Consultation.objects.create(patient=patient, doctor=doctor_user, consultation_date=timezone.now(), reason="Visit")
    surgery = Surgery.objects.create(patient=patient, surgeon=doctor_user, procedure_name="Procedure", indication="Indication")
    category = CareCategory.objects.create(name="Care")
    care_type = CareType.objects.create(category=category, name="Dressing")
    care = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=nurse_user,
        start_date=base_day,
        planned_sessions=1,
    )
    care_session = CareSession.objects.create(care=care, nurse=nurse_user)
    api_client.force_authenticate(user=secretary_user)
    response = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 13).isoformat(),
            "consultation": consultation.id,
            "surgery": surgery.id,
            "care_session": care_session.id,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    appointment_id = response.data["id"]
    api_client.post(f"/api/v1/appointments/{appointment_id}/confirm/")
    api_client.post(f"/api/v1/appointments/{appointment_id}/check-in/")
    api_client.post(f"/api/v1/appointments/{appointment_id}/start/")
    api_client.post(f"/api/v1/appointments/{appointment_id}/complete/")
    surgery.refresh_from_db()
    care_session.refresh_from_db()
    assert surgery.status == Surgery.Status.DRAFT
    assert care_session.status == CareSession.Status.PLANNED


@pytest.mark.django_db
def test_clinical_link_patient_mismatches_rejected(
    api_client,
    secretary_user,
    doctor_user,
    patient,
    consultation_type,
    working_hours,
    base_day,
):
    other = Patient.objects.create(first_name="Other", last_name="Patient")
    consultation = Consultation.objects.create(patient=other, doctor=doctor_user, consultation_date=timezone.now(), reason="Mismatch")
    api_client.force_authenticate(user=secretary_user)
    response = api_client.post(
        "/api/v1/appointments/",
        {
            "patient": patient.id,
            "appointment_type": consultation_type.id,
            "primary_staff": doctor_user.id,
            "start_at": aware_at(base_day, 13).isoformat(),
            "consultation": consultation.id,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_rbac_secretary_operational_admin_config_and_doctor_nurse_read(
    api_client,
    secretary_user,
    admin_user,
    doctor_user,
    nurse_user,
    appointment,
    base_day,
):
    api_client.force_authenticate(user=secretary_user)
    forbidden_config = api_client.post(
        "/api/v1/appointment-types/",
        {"name": "Admin only", "code": "admin-only", "default_duration_minutes": 30},
        format="json",
    )
    api_client.force_authenticate(user=admin_user)
    config = api_client.post(
        "/api/v1/appointment-types/",
        {"name": "Admin type", "code": "admin-type", "default_duration_minutes": 30},
        format="json",
    )
    api_client.force_authenticate(user=doctor_user)
    doctor_read = api_client.get(f"/api/v1/appointments/{appointment.id}/")
    api_client.force_authenticate(user=nurse_user)
    nurse_read = api_client.get(f"/api/v1/appointments/{appointment.id}/")
    assert forbidden_config.status_code == status.HTTP_403_FORBIDDEN
    assert config.status_code == status.HTTP_201_CREATED
    assert doctor_read.status_code == status.HTTP_200_OK
    assert nurse_read.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_agenda_day_week_filters_and_audit(api_client, secretary_user, appointment, base_day):
    api_client.force_authenticate(user=secretary_user)
    day = api_client.get(f"/api/v1/agenda/day/?date={base_day.isoformat()}&staff={appointment.primary_staff_id}")
    week = api_client.get(f"/api/v1/agenda/week/?date={base_day.isoformat()}")
    api_client.post(f"/api/v1/appointments/{appointment.id}/confirm/")
    api_client.post(f"/api/v1/appointments/{appointment.id}/check-in/")
    api_client.post(f"/api/v1/appointments/{appointment.id}/start/")
    api_client.post(f"/api/v1/appointments/{appointment.id}/complete/")

    assert day.status_code == status.HTTP_200_OK
    assert len(day.data) == 1
    assert week.status_code == status.HTTP_200_OK
    assert len(week.data) >= 1
    assert AuditLog.objects.filter(action="APPOINTMENT_CONFIRMED").count() == 1
    assert AuditLog.objects.filter(action="APPOINTMENT_CHECKED_IN").count() == 1
    assert AuditLog.objects.filter(action="APPOINTMENT_STARTED").count() == 1
    assert AuditLog.objects.filter(action="APPOINTMENT_COMPLETED").count() == 1
