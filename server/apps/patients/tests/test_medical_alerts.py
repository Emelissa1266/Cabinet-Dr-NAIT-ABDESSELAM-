import pytest
from rest_framework import status

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.patients.models import MedicalAlert, Patient


@pytest.fixture
def alert_patient(db, doctor_user):
    return Patient.objects.create(first_name="Amina", last_name="Kaci", created_by=doctor_user)


@pytest.fixture
def other_alert_patient(db, doctor_user):
    return Patient.objects.create(first_name="Lina", last_name="Dali", created_by=doctor_user)


def alert_payload(patient, **overrides):
    payload = {
        "patient": patient.id,
        "category": MedicalAlert.Category.ALLERGY,
        "severity": MedicalAlert.Severity.CRITICAL,
        "title": "Pénicilline",
        "description": "Réaction allergique documentée.",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_doctor_can_create_list_update_and_resolve_medical_alert(api_client, doctor_user, alert_patient):
    api_client.force_authenticate(user=doctor_user)

    created = api_client.post("/api/v1/medical-alerts/", alert_payload(alert_patient), format="json")
    alert_id = created.data["id"]
    listed = api_client.get(f"/api/v1/medical-alerts/?patient={alert_patient.id}&is_active=true")
    updated = api_client.patch(
        f"/api/v1/medical-alerts/{alert_id}/",
        {"severity": MedicalAlert.Severity.WARNING, "description": "Réaction ancienne."},
        format="json",
    )
    resolved = api_client.post(
        f"/api/v1/medical-alerts/{alert_id}/resolve/",
        {"resolution_note": "Alerte réévaluée."},
        format="json",
    )
    active_after_resolve = api_client.get(f"/api/v1/medical-alerts/?patient={alert_patient.id}&is_active=true")
    historical = api_client.get(f"/api/v1/medical-alerts/?patient={alert_patient.id}&is_active=false")

    assert created.status_code == status.HTTP_201_CREATED
    assert created.data["created_by"] == doctor_user.id
    assert listed.data["count"] == 1
    assert updated.status_code == status.HTTP_200_OK
    assert updated.data["severity"] == MedicalAlert.Severity.WARNING
    assert resolved.status_code == status.HTTP_200_OK
    assert resolved.data["is_active"] is False
    assert resolved.data["resolved_by"] == doctor_user.id
    assert active_after_resolve.data["count"] == 0
    assert historical.data["count"] == 1
    assert {
        "MEDICAL_ALERT_CREATED",
        "MEDICAL_ALERT_UPDATED",
        "MEDICAL_ALERT_RESOLVED",
    }.issubset(set(AuditLog.objects.values_list("action", flat=True)))


@pytest.mark.django_db
def test_created_by_is_server_authoritative(api_client, doctor_user, secretary_user, alert_patient):
    api_client.force_authenticate(user=doctor_user)

    response = api_client.post(
        "/api/v1/medical-alerts/",
        alert_payload(alert_patient, created_by=secretary_user.id),
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    alert = MedicalAlert.objects.get(pk=response.data["id"])
    assert alert.created_by == doctor_user


@pytest.mark.django_db
def test_medical_alert_permissions(api_client, doctor_user, nurse_user, secretary_user, alert_patient):
    MedicalAlert.objects.create(
        patient=alert_patient,
        category=MedicalAlert.Category.ANESTHESIA,
        severity=MedicalAlert.Severity.WARNING,
        title="Anesthésie",
        created_by=doctor_user,
    )

    anonymous = api_client.get("/api/v1/medical-alerts/")
    api_client.force_authenticate(user=nurse_user)
    nurse_read = api_client.get(f"/api/v1/medical-alerts/?patient={alert_patient.id}")
    nurse_create = api_client.post("/api/v1/medical-alerts/", alert_payload(alert_patient), format="json")
    api_client.force_authenticate(user=secretary_user)
    secretary_read = api_client.get(f"/api/v1/medical-alerts/?patient={alert_patient.id}")

    assert anonymous.status_code == status.HTTP_401_UNAUTHORIZED
    assert nurse_read.status_code == status.HTTP_200_OK
    assert nurse_read.data["count"] == 1
    assert nurse_create.status_code == status.HTTP_403_FORBIDDEN
    assert secretary_read.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_medical_alert_patient_filter_isolates_results(
    api_client,
    doctor_user,
    alert_patient,
    other_alert_patient,
):
    first = MedicalAlert.objects.create(
        patient=alert_patient,
        category=MedicalAlert.Category.CONTRAINDICATION,
        severity=MedicalAlert.Severity.CRITICAL,
        title="Laser",
        created_by=doctor_user,
    )
    MedicalAlert.objects.create(
        patient=other_alert_patient,
        category=MedicalAlert.Category.MEDICATION,
        severity=MedicalAlert.Severity.INFO,
        title="Traitement",
        created_by=doctor_user,
    )
    api_client.force_authenticate(user=doctor_user)

    filtered = api_client.get(f"/api/v1/medical-alerts/?patient={alert_patient.id}")

    assert filtered.status_code == status.HTTP_200_OK
    assert filtered.data["count"] == 1
    assert filtered.data["results"][0]["id"] == first.id


@pytest.mark.django_db
def test_medical_alert_patient_cannot_be_changed(api_client, doctor_user, alert_patient, other_alert_patient):
    alert = MedicalAlert.objects.create(
        patient=alert_patient,
        category=MedicalAlert.Category.ALLERGY,
        severity=MedicalAlert.Severity.CRITICAL,
        title="Latex",
        created_by=doctor_user,
    )
    api_client.force_authenticate(user=doctor_user)

    response = api_client.patch(
        f"/api/v1/medical-alerts/{alert.id}/",
        {"patient": other_alert_patient.id, "title": "Moved"},
        format="json",
    )
    alert.refresh_from_db()

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert alert.patient == alert_patient
    assert alert.title == "Latex"


@pytest.mark.django_db
def test_secretary_cannot_retrieve_alert_by_id(api_client, secretary_user, doctor_user, alert_patient):
    alert = MedicalAlert.objects.create(
        patient=alert_patient,
        category=MedicalAlert.Category.ALLERGY,
        severity=MedicalAlert.Severity.CRITICAL,
        title="Latex",
        created_by=doctor_user,
    )
    api_client.force_authenticate(user=secretary_user)

    response = api_client.get(f"/api/v1/medical-alerts/{alert.id}/")

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_inactive_user_cannot_read_medical_alerts(api_client, make_user, alert_patient):
    inactive = make_user(role=User.Role.DOCTOR, username="inactive-alerts", is_active=False)
    api_client.force_authenticate(user=inactive)

    response = api_client.get(f"/api/v1/medical-alerts/?patient={alert_patient.id}")

    assert response.status_code == status.HTTP_403_FORBIDDEN
