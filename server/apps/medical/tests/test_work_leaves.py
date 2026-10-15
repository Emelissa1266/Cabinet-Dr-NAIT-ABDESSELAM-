import os
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

import pytest
from django.conf import settings
from django.db import close_old_connections, connection
from django.test import override_settings
from django.utils import timezone
from pypdf import PdfReader
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.medical.models import Consultation, WorkLeave
from apps.medical.work_leave_services import create_leave
from apps.patients.models import Patient


@pytest.fixture
def payload(doctor_user):
    patient = Patient.objects.create(
        first_name="TEST Élise",
        last_name="Patient fictif",
        created_by=doctor_user,
        date_of_birth="1990-02-03",
    )
    return {
        "patient": patient.pk,
        "issued_date": "2026-10-14",
        "start_date": "2026-10-14",
        "end_date": "2026-10-20",
        "medical_reason": "TEST DIAGNOSTIC CONFIDENTIEL",
        "internal_notes": "TEST NOTE INTERNE",
        "patient_instructions": "TEST INSTRUCTIONS PRIVÉES",
    }


@pytest.fixture
def draft(api_client, doctor_user, payload):
    api_client.force_authenticate(doctor_user)
    response = api_client.post("/api/v1/work-leaves/", payload, format="json")
    assert response.status_code == 201, response.data
    return response.data


def issue(client, row):
    response = client.post(f"/api/v1/work-leaves/{row['id']}/issue/", {}, format="json")
    assert response.status_code == 200, response.data
    return response.data


@pytest.mark.django_db
def test_draft_duration_patient_list_number_and_edit(api_client, draft, payload):
    assert draft["status"] == "DRAFT"
    assert draft["duration_days"] == 7
    assert draft["certificate_number"].startswith(f"AT-{timezone.localdate().year}-")
    assert draft["patient_name"] == "TEST Élise Patient fictif"
    second = api_client.post("/api/v1/work-leaves/", payload, format="json")
    assert second.status_code == 201
    assert second.data["certificate_number"] != draft["certificate_number"]
    listing = api_client.get(
        "/api/v1/work-leaves/",
        {"patient": payload["patient"], "status": "DRAFT", "search": draft["certificate_number"]},
    )
    assert listing.data["count"] == 1
    updated = api_client.patch(
        f"/api/v1/work-leaves/{draft['id']}/", {"end_date": "2026-10-14"}, format="json"
    )
    assert updated.status_code == 200
    assert updated.data["duration_days"] == 1
    assert [event["action"] for event in updated.data["history"]] == [
        "WORK_LEAVE_CREATED",
        "WORK_LEAVE_UPDATED",
    ]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "changes",
    [
        {"end_date": "2026-10-13"},
        {"duration_days": 99},
        {"doctor": 1},
        {"status": "ISSUED"},
        {"certificate_number": "FORGED"},
        {"leave_type": "EXTENSION"},
    ],
)
def test_invalid_or_forged_draft_rejected(api_client, doctor_user, payload, changes):
    api_client.force_authenticate(doctor_user)
    response = api_client.post("/api/v1/work-leaves/", {**payload, **changes}, format="json")
    assert response.status_code == 400
    assert WorkLeave.objects.count() == 0


@pytest.mark.django_db
def test_optional_consultation_and_cross_patient_consultation_rejected(
    api_client, draft, doctor_user, payload
):
    consultation = Consultation.objects.create(
        patient_id=payload["patient"],
        doctor=doctor_user,
        consultation_date=timezone.now(),
        reason="TEST consultation",
    )
    response = api_client.patch(
        f"/api/v1/work-leaves/{draft['id']}/", {"consultation": consultation.pk}, format="json"
    )
    assert response.status_code == 200
    assert response.data["consultation"] == consultation.pk
    other = Patient.objects.create(first_name="TEST", last_name="Other", created_by=doctor_user)
    wrong = api_client.post(
        "/api/v1/work-leaves/",
        {**payload, "patient": other.pk, "consultation": consultation.pk},
        format="json",
    )
    assert wrong.status_code == 400
    listing = api_client.get("/api/v1/work-leaves/", {"consultation": consultation.pk})
    assert listing.data["count"] == 1


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["ADMIN", "NURSE", "SECRETARY"])
def test_non_doctor_has_no_clinical_access(api_client, draft, payload, make_user, role):
    actor = make_user(role=role, username="non-doctor")
    api_client.force_authenticate(actor)
    base = f"/api/v1/work-leaves/{draft['id']}/"
    for endpoint in ["/api/v1/work-leaves/", base, base + "pdf/", base + "print/"]:
        response = api_client.get(endpoint)
        assert response.status_code == 403
        assert "TEST DIAGNOSTIC" not in str(response.data)
    for endpoint in ["/api/v1/work-leaves/", base + "issue/", base + "cancel/"]:
        assert api_client.post(endpoint, payload, format="json").status_code == 403
    assert api_client.patch(base, {"end_date": "2026-10-22"}, format="json").status_code == 403
    assert api_client.delete(base).status_code == 403


@pytest.mark.django_db
def test_other_doctor_cannot_read_modify_issue_pdf_or_link_certificate(
    api_client, draft, make_user, payload
):
    actor = make_user(role=User.Role.DOCTOR, username="another-doctor")
    api_client.force_authenticate(actor)
    assert api_client.get("/api/v1/work-leaves/").data["count"] == 0
    base = f"/api/v1/work-leaves/{draft['id']}/"
    for endpoint in [base, base + "pdf/", base + "print/"]:
        assert api_client.get(endpoint).status_code == 404
    assert api_client.post(base + "issue/", {}, format="json").status_code == 404
    assert api_client.patch(base, {"end_date": "2026-10-22"}, format="json").status_code == 404
    assert api_client.delete(base).status_code == 404
    assert (
        api_client.post(
            "/api/v1/work-leaves/",
            {**payload, "leave_type": "EXTENSION", "previous_leave": draft["id"]},
            format="json",
        ).status_code
        == 400
    )


@pytest.mark.django_db
def test_issue_freezes_and_cancel_retains_history(api_client, draft):
    emitted = issue(api_client, draft)
    assert emitted["status"] == "ISSUED" and emitted["issued_at"]
    base = f"/api/v1/work-leaves/{draft['id']}/"
    assert api_client.patch(base, {"start_date": "2026-10-01"}, format="json").status_code == 400
    assert api_client.delete(base).status_code == 400
    assert api_client.post(base + "issue/", {}, format="json").status_code == 400
    assert (
        api_client.post(base + "cancel/", {"cancellation_reason": " "}, format="json").status_code
        == 400
    )
    cancelled = api_client.post(
        base + "cancel/",
        {"cancellation_reason": "TEST correction avec remplacement"},
        format="json",
    )
    assert cancelled.status_code == 200
    assert cancelled.data["status"] == "CANCELLED" and cancelled.data["cancelled_at"]
    assert cancelled.data["start_date"] == draft["start_date"]
    assert api_client.patch(base, {"medical_reason": "erased"}, format="json").status_code == 400
    assert api_client.delete(base).status_code == 400
    assert WorkLeave.objects.filter(pk=draft["id"]).exists()
    assert "WORK_LEAVE_CANCELLED" in [event["action"] for event in cancelled.data["history"]]
    for event in AuditLog.objects.filter(entity_type="WorkLeave"):
        assert "CONFIDENTIEL" not in str(event.new_data)
        assert "NOTE INTERNE" not in str(event.new_data)


@pytest.mark.django_db
def test_extension_same_patient_chronology_and_predecessor(api_client, draft, payload, doctor_user):
    parent = issue(api_client, draft)
    extension = {
        **payload,
        "leave_type": "EXTENSION",
        "previous_leave": parent["id"],
        "start_date": "2026-10-21",
        "end_date": "2026-10-23",
    }
    response = api_client.post("/api/v1/work-leaves/", extension, format="json")
    assert response.status_code == 201
    assert response.data["duration_days"] == 3
    assert response.data["previous_reference"] == parent["certificate_number"]
    issue(api_client, response.data)
    assert (
        api_client.post(
            "/api/v1/work-leaves/", {**extension, "start_date": "2026-10-20"}, format="json"
        ).status_code
        == 400
    )
    other = Patient.objects.create(first_name="TEST", last_name="Different", created_by=doctor_user)
    assert (
        api_client.post(
            "/api/v1/work-leaves/", {**extension, "patient": other.pk}, format="json"
        ).status_code
        == 400
    )
    assert WorkLeave.objects.filter(previous_leave_id=parent["id"]).count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "state,marker",
    [
        ("DRAFT", "BROUILLON - NON VALIDE"),
        ("ISSUED", "7 jours calendaires"),
        ("CANCELLED", "ANNULÉ"),
    ],
)
@pytest.mark.parametrize("endpoint,disposition", [("pdf", "attachment"), ("print", "inline")])
def test_private_a4_pdf_content_status_and_no_diagnosis(
    api_client, draft, state, marker, endpoint, disposition
):
    if state != "DRAFT":
        issue(api_client, draft)
    if state == "CANCELLED":
        assert (
            api_client.post(
                f"/api/v1/work-leaves/{draft['id']}/cancel/",
                {"cancellation_reason": "TEST motif privé"},
                format="json",
            ).status_code
            == 200
        )
    response = api_client.get(f"/api/v1/work-leaves/{draft['id']}/{endpoint}/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response["Content-Disposition"].startswith(disposition + ";")
    assert f"Arret_Travail_{draft['certificate_number']}.pdf" in response["Content-Disposition"]
    assert "no-store" in response["Cache-Control"]
    reader = PdfReader(BytesIO(response.content))
    assert len(reader.pages) == 1
    assert abs(float(reader.pages[0].mediabox.width) - 595.28) < 0.1
    assert abs(float(reader.pages[0].mediabox.height) - 841.89) < 0.1
    assert reader.pages[0].images
    text = reader.pages[0].extract_text()
    for value in [
        marker,
        "Dr Nait Abdesselam Gaya",
        "0668 39 82 52",
        "TEST Élise",
        "14/10/2026",
        "20/10/2026",
        "Signature et cachet",
        draft["certificate_number"],
    ]:
        assert value in text
    for secret in [
        "TEST DIAGNOSTIC",
        "TEST NOTE INTERNE",
        "TEST INSTRUCTIONS PRIVÉES",
        "TEST motif privé",
    ]:
        assert secret not in text
    if (folder := os.getenv("WORK_LEAVE_QA_DIR")) and endpoint == "pdf":
        Path(folder).mkdir(parents=True, exist_ok=True)
        (Path(folder) / f"arret-{state.lower()}.pdf").write_bytes(response.content)


@pytest.mark.django_db
def test_issued_identity_and_text_survive_patient_profile_or_template_change(api_client, draft):
    issue(api_client, draft)
    leave = WorkLeave.objects.get(pk=draft["id"])
    Patient.objects.filter(pk=leave.patient_id).update(first_name="TEST CHANGED")
    with override_settings(WORK_LEAVE_CERTIFICATE_TEXT="CHANGED TEMPLATE"):
        response = api_client.get(f"/api/v1/work-leaves/{leave.pk}/pdf/")
    text = PdfReader(BytesIO(response.content)).pages[0].extract_text()
    assert "TEST Élise" in text and "TEST CHANGED" not in text and "CHANGED TEMPLATE" not in text


@pytest.mark.django_db
def test_draft_deletion_audited_and_anonymous_denied(api_client, draft):
    pk = draft["id"]
    assert api_client.delete(f"/api/v1/work-leaves/{pk}/").status_code == 204
    assert not WorkLeave.objects.filter(pk=pk).exists()
    assert AuditLog.objects.filter(action="WORK_LEAVE_DELETED", entity_id=str(pk)).exists()
    api_client.force_authenticate(None)
    assert api_client.get("/api/v1/work-leaves/").status_code == 401


@pytest.mark.django_db
def test_cookie_jwt_csrf_creation_and_issue(doctor_user, payload):
    client = APIClient(enforce_csrf_checks=True)
    csrf = client.get("/api/v1/auth/csrf/").cookies[settings.CSRF_COOKIE_NAME].value
    login = client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "safe-test-password"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf,
    )
    assert login.status_code == 200
    csrf = client.cookies[settings.CSRF_COOKIE_NAME].value
    assert client.post("/api/v1/work-leaves/", payload, format="json").status_code == 403
    created = client.post("/api/v1/work-leaves/", payload, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert created.status_code == 201
    url = f"/api/v1/work-leaves/{created.data['id']}/issue/"
    assert client.post(url, {}, format="json").status_code == 403
    assert client.post(url, {}, format="json", HTTP_X_CSRFTOKEN=csrf).status_code == 200
    assert client.get(f"/api/v1/work-leaves/{created.data['id']}/pdf/").status_code == 200


@pytest.mark.django_db(transaction=True)
def test_postgres_concurrent_number_generation(doctor_user, payload):
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL row locks are required for this concurrency test")

    def worker(_):
        close_old_connections()
        try:
            actor = User.objects.get(pk=doctor_user.pk)
            data = {**payload, "patient": Patient.objects.get(pk=payload["patient"])}
            return create_leave(actor=actor, data=data).certificate_number
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=4) as executor:
        numbers = list(executor.map(worker, range(8)))
    assert len(set(numbers)) == 8


@pytest.mark.django_db
def test_certificate_history_cannot_be_deleted_via_patient_or_consultation(
    api_client, draft, doctor_user, payload
):
    consultation = Consultation.objects.create(
        patient_id=payload["patient"],
        doctor=doctor_user,
        consultation_date=timezone.now(),
        reason="TEST retention",
    )
    assert (
        api_client.patch(
            f"/api/v1/work-leaves/{draft['id']}/", {"consultation": consultation.pk}, format="json"
        ).status_code
        == 200
    )
    issue(api_client, draft)
    assert api_client.delete(f"/api/v1/consultations/{consultation.pk}/").status_code == 400
    assert api_client.delete(f"/api/v1/patients/{payload['patient']}/").status_code == 400
    assert WorkLeave.objects.filter(pk=draft["id"]).exists()
    assert Consultation.objects.filter(pk=consultation.pk).exists()
    assert Patient.objects.filter(pk=payload["patient"]).exists()
    assert not AuditLog.objects.filter(
        action="PATIENT_DELETED", entity_id=str(payload["patient"])
    ).exists()
