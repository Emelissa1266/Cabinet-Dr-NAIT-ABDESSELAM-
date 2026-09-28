from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.care.models import (
    Care,
    CareCategory,
    CareObservation,
    CareParameterDefinition,
    CareSession,
    CareSessionMaterial,
    CareSessionParameter,
    CareType,
    ClinicalMeasurement,
)
from apps.patients.models import Patient


@pytest.fixture
def patient(db, doctor_user):
    return Patient.objects.create(first_name="Care", last_name="Patient", created_by=doctor_user)


@pytest.fixture
def care_category(db):
    return CareCategory.objects.create(name="Wound care", description="Post-operative wound care")


@pytest.fixture
def care_type(care_category):
    return CareType.objects.create(
        category=care_category,
        name="Dressing",
        default_duration_minutes=30,
        default_price=Decimal("1500.00"),
        requires_vital_signs=True,
        requires_observation=True,
    )


@pytest.fixture
def care_plan(patient, doctor_user, nurse_user, care_type):
    return Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=nurse_user,
        start_date=timezone.localdate(),
        planned_sessions=2,
        price_per_session=Decimal("1500.00"),
    )


@pytest.fixture
def care_session(care_plan, nurse_user):
    return CareSession.objects.create(care=care_plan, nurse=nurse_user, scheduled_at=timezone.now())


@pytest.mark.django_db
def test_care_catalog_crud_permissions(api_client, admin_user, secretary_user):
    api_client.force_authenticate(user=admin_user)
    category = api_client.post(
        "/api/v1/care-categories/",
        {"name": "Injection", "description": "Injectable care", "is_active": True},
        format="json",
    )
    assert category.status_code == status.HTTP_201_CREATED

    care_type = api_client.post(
        "/api/v1/care-types/",
        {
            "category": category.data["id"],
            "name": "IM injection",
            "description": "Intramuscular injection",
            "default_duration_minutes": 15,
            "default_price": "1200.00",
            "requires_vital_signs": False,
            "requires_observation": True,
            "is_active": True,
        },
        format="json",
    )
    assert care_type.status_code == status.HTTP_201_CREATED

    api_client.force_authenticate(user=secretary_user)
    before = CareCategory.objects.count()
    forbidden = api_client.post("/api/v1/care-categories/", {"name": "Forbidden"}, format="json")
    assert forbidden.status_code == status.HTTP_403_FORBIDDEN
    assert CareCategory.objects.count() == before


@pytest.mark.django_db
def test_doctor_create_care_assignment_and_computed_pricing(api_client, doctor_user, nurse_user, patient, care_type):
    api_client.force_authenticate(user=doctor_user)

    response = api_client.post(
        "/api/v1/cares/",
        {
            "patient": patient.id,
            "care_type": care_type.id,
            "assigned_nurse": nurse_user.id,
            "start_date": timezone.localdate().isoformat(),
            "planned_sessions": 4,
            "price_per_session": "1500.00",
            "status": "PLANNED",
            "notes": "Doctor prescribed care",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["prescribed_by"] == doctor_user.id
    assert response.data["total_price"] == "6000.00"
    assert response.data["completed_sessions"] == 0
    assert response.data["remaining_sessions"] == 4
    assert response.data["progress_percentage"] == 0
    assert AuditLog.objects.filter(action="CARE_CREATED").count() == 1


@pytest.mark.django_db
def test_care_validation_for_sessions_and_price(api_client, doctor_user, nurse_user, patient, care_type):
    api_client.force_authenticate(user=doctor_user)
    payload = {
        "patient": patient.id,
        "care_type": care_type.id,
        "assigned_nurse": nurse_user.id,
        "start_date": timezone.localdate().isoformat(),
        "planned_sessions": 0,
        "price_per_session": "-1.00",
    }

    response = api_client.post("/api/v1/cares/", payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert Care.objects.count() == 0


@pytest.mark.django_db
def test_nurse_can_read_assigned_care_but_secretary_cannot(api_client, nurse_user, secretary_user, care_plan):
    api_client.force_authenticate(user=nurse_user)
    nurse_response = api_client.get(f"/api/v1/cares/{care_plan.id}/")

    api_client.force_authenticate(user=secretary_user)
    secretary_response = api_client.get(f"/api/v1/cares/{care_plan.id}/")

    assert nurse_response.status_code == status.HTTP_200_OK
    assert secretary_response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_secretary_and_nurse_cannot_prescribe_care(api_client, secretary_user, nurse_user, patient, care_type):
    for user in (secretary_user, nurse_user):
        api_client.force_authenticate(user=user)
        response = api_client.post(
            "/api/v1/cares/",
            {
                "patient": patient.id,
                "care_type": care_type.id,
                "start_date": timezone.localdate().isoformat(),
                "planned_sessions": 1,
                "price_per_session": "0.00",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
    assert Care.objects.count() == 0


@pytest.mark.django_db
def test_care_session_start_complete_required_parameters_and_progress(
    api_client,
    nurse_user,
    care_plan,
    care_session,
    care_type,
):
    definition = CareParameterDefinition.objects.create(
        care_type=care_type,
        key="wound-location",
        label="Wound location",
        data_type="TEXT",
        required=True,
    )
    api_client.force_authenticate(user=nurse_user)

    start = api_client.post(f"/api/v1/care-sessions/{care_session.id}/start/")
    assert start.status_code == status.HTTP_200_OK
    assert start.data["status"] == "IN_PROGRESS"
    assert start.data["started_at"] is not None

    missing_required = api_client.post(f"/api/v1/care-sessions/{care_session.id}/complete/")
    assert missing_required.status_code == status.HTTP_400_BAD_REQUEST

    parameter = api_client.post(
        "/api/v1/care-session-parameters/",
        {
            "care_session": care_session.id,
            "parameter_definition": definition.id,
            "value": "Left cheek",
        },
        format="json",
    )
    assert parameter.status_code == status.HTTP_201_CREATED

    complete = api_client.post(f"/api/v1/care-sessions/{care_session.id}/complete/")
    care_plan.refresh_from_db()
    assert complete.status_code == status.HTTP_200_OK
    assert complete.data["status"] == "COMPLETED"
    assert care_plan.status == Care.Status.IN_PROGRESS
    assert care_plan.completed_sessions == 1
    assert care_plan.remaining_sessions == 1
    assert care_plan.progress_percentage == 50
    assert AuditLog.objects.filter(action="CARE_SESSION_STARTED").count() == 1
    assert AuditLog.objects.filter(action="CARE_SESSION_COMPLETED").count() == 1


@pytest.mark.django_db
def test_invalid_session_state_transitions_do_not_modify_state(api_client, nurse_user, care_session):
    api_client.force_authenticate(user=nurse_user)

    direct_complete = api_client.post(f"/api/v1/care-sessions/{care_session.id}/complete/")
    care_session.refresh_from_db()
    assert direct_complete.status_code == status.HTTP_400_BAD_REQUEST
    assert care_session.status == CareSession.Status.PLANNED

    api_client.post(f"/api/v1/care-sessions/{care_session.id}/start/")
    restart = api_client.post(f"/api/v1/care-sessions/{care_session.id}/start/")
    care_session.refresh_from_db()
    assert restart.status_code == status.HTTP_400_BAD_REQUEST
    assert care_session.status == CareSession.Status.IN_PROGRESS


@pytest.mark.django_db
def test_unauthorized_nurse_cannot_start_assigned_session(api_client, make_user, care_session):
    other_nurse = make_user(role=User.Role.NURSE, username="other-nurse")
    api_client.force_authenticate(user=other_nurse)

    response = api_client.post(f"/api/v1/care-sessions/{care_session.id}/start/")

    care_session.refresh_from_db()
    assert response.status_code in {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND}
    assert care_session.status == CareSession.Status.PLANNED


@pytest.mark.django_db
def test_completed_session_count_marks_care_completed(api_client, nurse_user, care_plan, care_type):
    care_plan.planned_sessions = 1
    care_plan.save(update_fields=["planned_sessions"])
    session = CareSession.objects.create(care=care_plan, nurse=nurse_user)
    CareParameterDefinition.objects.create(care_type=care_type, key="site", label="Site", required=False)
    api_client.force_authenticate(user=nurse_user)

    api_client.post(f"/api/v1/care-sessions/{session.id}/start/")
    complete = api_client.post(f"/api/v1/care-sessions/{session.id}/complete/")

    care_plan.refresh_from_db()
    assert complete.status_code == status.HTTP_200_OK
    assert care_plan.completed_sessions == 1
    assert care_plan.status == Care.Status.COMPLETED
    assert care_plan.progress_percentage == 100


@pytest.mark.django_db
def test_observations_chronological_and_permission_enforced(api_client, nurse_user, doctor_user, care_session):
    api_client.force_authenticate(user=nurse_user)
    first = api_client.post(
        "/api/v1/care-observations/",
        {"care_session": care_session.id, "observation": "First observation"},
        format="json",
    )
    second = api_client.post(
        "/api/v1/care-observations/",
        {"care_session": care_session.id, "observation": "Second observation"},
        format="json",
    )

    api_client.force_authenticate(user=doctor_user)
    listing = api_client.get(f"/api/v1/care-observations/?care_session={care_session.id}")
    forbidden = api_client.post(
        "/api/v1/care-observations/",
        {"care_session": care_session.id, "observation": "Doctor execution"},
        format="json",
    )

    assert first.status_code == status.HTTP_201_CREATED
    assert second.status_code == status.HTTP_201_CREATED
    assert [item["observation"] for item in listing.data["results"]] == [
        "First observation",
        "Second observation",
    ]
    assert forbidden.status_code == status.HTTP_403_FORBIDDEN
    assert CareObservation.objects.count() == 2


@pytest.mark.django_db
def test_measurements_materials_and_parameter_value_validation(api_client, nurse_user, care_session, care_type):
    definition = CareParameterDefinition.objects.create(
        care_type=care_type,
        key="pain-score",
        label="Pain score",
        data_type="NUMBER",
        required=False,
    )
    api_client.force_authenticate(user=nurse_user)

    measurement = api_client.post(
        "/api/v1/clinical-measurements/",
        {
            "care_session": care_session.id,
            "measurement_type": "TEMPERATURE",
            "value": "37.1",
            "unit": "C",
        },
        format="json",
    )
    bad_measurement = api_client.post(
        "/api/v1/clinical-measurements/",
        {
            "care_session": care_session.id,
            "measurement_type": "TEMPERATURE",
            "value": "",
            "unit": "",
        },
        format="json",
    )
    material = api_client.post(
        "/api/v1/care-session-materials/",
        {"care_session": care_session.id, "name": "Sterile gauze", "quantity": "2.00", "unit": "piece"},
        format="json",
    )
    bad_material = api_client.post(
        "/api/v1/care-session-materials/",
        {"care_session": care_session.id, "name": "Invalid", "quantity": "0.00", "unit": "piece"},
        format="json",
    )
    parameter = api_client.post(
        "/api/v1/care-session-parameters/",
        {"care_session": care_session.id, "parameter_definition": definition.id, "value": "3"},
        format="json",
    )

    assert measurement.status_code == status.HTTP_201_CREATED
    assert bad_measurement.status_code == status.HTTP_400_BAD_REQUEST
    assert material.status_code == status.HTTP_201_CREATED
    assert bad_material.status_code == status.HTTP_400_BAD_REQUEST
    assert parameter.status_code == status.HTTP_201_CREATED
    assert ClinicalMeasurement.objects.count() == 1
    assert CareSessionMaterial.objects.count() == 1
    assert CareSessionParameter.objects.count() == 1
    assert AuditLog.objects.filter(action="CLINICAL_MEASUREMENT_RECORDED").count() == 1
