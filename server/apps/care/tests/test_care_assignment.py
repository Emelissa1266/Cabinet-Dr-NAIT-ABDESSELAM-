"""Assignment regressions use isolated test records, never the cabinet database."""
import pytest
from django.conf import settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.care.models import Care, CareCategory, CareSession, CareType
from apps.patients.models import Patient


@pytest.fixture
def assignment_payload(doctor_user):
    patient = Patient.objects.create(first_name="Assignment", last_name="Patient", created_by=doctor_user)
    category = CareCategory.objects.create(name="Assignment care")
    care_type = CareType.objects.create(category=category, name="Assignment dressing", default_price="1500.00")
    return {"patient": patient.pk, "care_type": care_type.pk,
            "start_date": timezone.localdate().isoformat(), "planned_sessions": 2,
            "price_per_session": "1500.00", "status": "PLANNED"}


def visible_ids(client):
    ids = set()
    page = 1
    while True:
        response = client.get("/api/v1/cares/", {"page": page})
        assert response.status_code == 200
        ids.update(row["id"] for row in response.data["results"])
        if not response.data["next"]:
            return ids
        page += 1


@pytest.mark.django_db
def test_doctor_assignment_reassignment_and_patient_detail(api_client, doctor_user, nurse_user, make_user, assignment_payload):
    other = make_user(role=User.Role.NURSE, username="assignment-b")
    api_client.force_authenticate(doctor_user)
    created = api_client.post("/api/v1/cares/", {**assignment_payload, "assigned_nurse": nurse_user.pk}, format="json")
    assert created.status_code == 201
    care_id = created.data["id"]
    assert created.data["assigned_nurse"] == nurse_user.pk
    assert created.data["assigned_nurse_name"] == nurse_user.get_full_name()
    assert created.data["status"] == "PLANNED"
    assert created.data["completed_sessions"] == 0
    assert not CareSession.objects.filter(care_id=care_id).exists()
    assert Care.objects.get(pk=care_id).assigned_nurse_id == nurse_user.pk
    detail = api_client.get(f"/api/v1/cares/{care_id}/")
    assert detail.data == created.data
    patient_list = api_client.get("/api/v1/cares/", {"patient": assignment_payload["patient"]})
    assert patient_list.data["results"][0] == created.data
    api_client.force_authenticate(nurse_user)
    assert care_id in visible_ids(api_client)
    assert api_client.get(f"/api/v1/cares/{care_id}/").status_code == 200
    api_client.force_authenticate(other)
    assert care_id not in visible_ids(api_client)
    assert api_client.get(f"/api/v1/cares/{care_id}/").status_code == 404
    assert api_client.patch(f"/api/v1/cares/{care_id}/", {"notes": "forbidden"}, format="json").status_code == 404
    api_client.force_authenticate(doctor_user)
    updated = api_client.patch(f"/api/v1/cares/{care_id}/", {"assigned_nurse": other.pk}, format="json")
    assert updated.status_code == 200
    assert updated.data["assigned_nurse"] == other.pk
    assert Care.objects.get(pk=care_id).assigned_nurse_id == other.pk
    audit = AuditLog.objects.get(action="CARE_UPDATED", entity_id=str(care_id))
    assert audit.old_data["assigned_nurse"] == nurse_user.pk
    assert audit.new_data["assigned_nurse"] == other.pk
    api_client.force_authenticate(nurse_user)
    assert care_id not in visible_ids(api_client)
    assert api_client.get(f"/api/v1/cares/{care_id}/").status_code == 404
    api_client.force_authenticate(other)
    assert care_id in visible_ids(api_client)
    session = api_client.post("/api/v1/care-sessions/", {"care": care_id, "scheduled_at": timezone.now().isoformat()}, format="json")
    assert session.status_code == 201
    assert session.data["nurse"] == other.pk


@pytest.mark.django_db
def test_assignment_survives_cookie_logout_login(api_client, doctor_user, nurse_user, assignment_payload):
    api_client.force_authenticate(doctor_user)
    created = api_client.post("/api/v1/cares/", {**assignment_payload, "assigned_nurse": nurse_user.pk}, format="json")
    assert created.status_code == 201
    client = APIClient(enforce_csrf_checks=True)
    for _ in range(2):
        csrf = client.get("/api/v1/auth/csrf/").cookies[settings.CSRF_COOKIE_NAME].value
        login = client.post("/api/v1/auth/login/", {"username": nurse_user.username, "password": "safe-test-password"}, format="json", HTTP_X_CSRFTOKEN=csrf)
        assert login.status_code == 200
        assert created.data["id"] in visible_ids(client)
        csrf = client.cookies[settings.CSRF_COOKIE_NAME].value
        assert client.post("/api/v1/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=csrf).status_code == 204


@pytest.mark.django_db
def test_reassigned_nurse_authored_care_cannot_be_reclaimed(api_client, doctor_user, nurse_user, make_user, assignment_payload):
    other = make_user(role=User.Role.NURSE, username="assignment-new")
    api_client.force_authenticate(nurse_user)
    created = api_client.post("/api/v1/cares/", assignment_payload, format="json")
    assert created.status_code == 201
    care_id = created.data["id"]
    api_client.force_authenticate(doctor_user)
    assert api_client.patch(f"/api/v1/cares/{care_id}/", {"assigned_nurse": other.pk}, format="json").status_code == 200
    api_client.force_authenticate(nurse_user)
    assert care_id not in visible_ids(api_client)
    assert api_client.patch(f"/api/v1/cares/{care_id}/", {"notes": "reclaim"}, format="json").status_code == 404
    assert api_client.post("/api/v1/care-sessions/", {"care": care_id, "scheduled_at": timezone.now().isoformat()}, format="json").status_code == 400
    api_client.force_authenticate(other)
    assert care_id in visible_ids(api_client)
    assert api_client.patch(f"/api/v1/cares/{care_id}/", {"notes": "managed autonomously"}, format="json").status_code == 200


@pytest.mark.django_db
def test_assigned_care_beyond_first_page(api_client, doctor_user, nurse_user, assignment_payload):
    api_client.force_authenticate(doctor_user)
    for _ in range(settings.REST_FRAMEWORK["PAGE_SIZE"] + 1):
        created = api_client.post("/api/v1/cares/", {**assignment_payload, "assigned_nurse": nurse_user.pk}, format="json")
        assert created.status_code == 201
    api_client.force_authenticate(nurse_user)
    first = api_client.get("/api/v1/cares/")
    assert first.data["next"] is not None
    assert len(visible_ids(api_client)) == settings.REST_FRAMEWORK["PAGE_SIZE"] + 1


@pytest.mark.django_db
@pytest.mark.parametrize("role", [User.Role.DOCTOR, User.Role.SECRETARY, User.Role.ADMIN])
def test_assignment_rejects_non_nurse(api_client, doctor_user, make_user, assignment_payload, role):
    invalid = make_user(role=role, username="invalid-assignee")
    api_client.force_authenticate(doctor_user)
    response = api_client.post("/api/v1/cares/", {**assignment_payload, "assigned_nurse": invalid.pk}, format="json")
    assert response.status_code == 400
    assert Care.objects.count() == 0
