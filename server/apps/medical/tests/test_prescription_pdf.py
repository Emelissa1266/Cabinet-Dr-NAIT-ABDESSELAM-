import os
from datetime import date
from io import BytesIO
from pathlib import Path

import pytest
from django.conf import settings
from django.utils import timezone
from pypdf import PdfReader
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.medical.models import Consultation, Prescription, PrescriptionItem
from apps.patients.models import Patient


@pytest.fixture
def prescription(api_client, doctor_user):
    doctor_user.phone = "+213000000000"
    doctor_user.save()
    patient = Patient.objects.create(
        first_name="TEST Élise",
        last_name="Test Patient",
        date_of_birth=date(1990, 2, 3),
        created_by=doctor_user,
    )
    consultation = Consultation.objects.create(
        patient=patient, doctor=doctor_user, consultation_date=timezone.now(), reason="TEST"
    )
    api_client.force_authenticate(doctor_user)
    response = api_client.post(
        "/api/v1/prescriptions/",
        {
            "patient": patient.pk,
            "consultation": consultation.pk,
            "prescribed_at": timezone.now().isoformat(),
            "status": "ACTIVE",
            "general_instructions": "TEST instructions générales enregistrées",
            "notes": "TEST notes médicales enregistrées",
            "items": [
                {
                    "medication_name": "TEST médicament fictif",
                    "dosage": "TEST dose enregistrée",
                    "frequency": "TEST fréquence enregistrée",
                    "duration": "TEST durée",
                    "quantity": 3,
                    "route": "TEST voie",
                    "instructions": "TEST <dose> & instruction",
                    "start_date": "2026-10-13",
                    "end_date": "2026-10-20",
                }
            ],
        },
        format="json",
    )
    assert response.status_code == 201
    result = Prescription.objects.get(pk=response.data["id"])
    listed = api_client.get("/api/v1/prescriptions/", {"patient": patient.pk})
    assert listed.data["results"][0]["id"] == result.pk
    return result


@pytest.mark.django_db
@pytest.mark.parametrize(
    "endpoint,disposition,action",
    [
        ("pdf", "attachment", "PRESCRIPTION_PDF_DOWNLOADED"),
        ("print", "inline", "PRESCRIPTION_PRINT_VIEWED"),
    ],
)
def test_doctor_pdf_content_headers_audit_and_integrity(
    api_client, prescription, endpoint, disposition, action
):
    before = list(prescription.items.values())
    before_prescription = Prescription.objects.values().get(pk=prescription.pk)
    response = api_client.get(f"/api/v1/prescriptions/{prescription.pk}/{endpoint}/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response["Content-Disposition"].startswith(disposition + ";")
    assert "Ordonnance_test-patient-test-elise_" in response["Content-Disposition"]
    assert response["Content-Disposition"].endswith('.pdf"')
    assert "no-store" in response["Cache-Control"]
    assert "Cookie" in response["Vary"]
    reader = PdfReader(BytesIO(response.content))
    assert len(reader.pages) == 1
    assert abs(float(reader.pages[0].mediabox.width) - 595.28) < 0.1
    assert abs(float(reader.pages[0].mediabox.height) - 841.89) < 0.1
    text = "\n".join(page.extract_text() for page in reader.pages)
    for value in [
        "TEST Élise",
        "03/02/1990",
        "Chirurgien plastique & esthétique",
        prescription.doctor.get_full_name(),
        "0668 39 82 52",
        "Dr Nait Abdesselam Gaya",
        "TEST médicament fictif",
        "TEST dose enregistrée",
        "TEST fréquence enregistrée",
        "TEST durée",
        "TEST voie",
        "Quantité : 3",
        "TEST <dose> & instruction",
        "13/10/2026",
        "20/10/2026",
        prescription.general_instructions,
        prescription.notes,
        "Signature et cachet",
    ]:
        assert value in text
    if endpoint == "pdf" and (folder := os.getenv("PDF_DESIGN_QA_DIR")):
        Path(folder).mkdir(parents=True, exist_ok=True)
        (Path(folder) / "ordonnance.pdf").write_bytes(response.content)
    assert reader.pages[0].images
    assert list(prescription.items.values()) == before
    assert Prescription.objects.values().get(pk=prescription.pk) == before_prescription
    audit = AuditLog.objects.get(action=action, entity_id=str(prescription.pk))
    assert audit.old_data is None and audit.new_data is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role,expected", [("DOCTOR", 200), ("NURSE", 200), ("ADMIN", 200), ("SECRETARY", 403)]
)
@pytest.mark.parametrize("endpoint", ["pdf", "print"])
def test_pdf_preserves_medical_rbac(api_client, prescription, make_user, role, expected, endpoint):
    actor = make_user(role=role, username="pdf-reader")
    api_client.force_authenticate(actor)
    response = api_client.get(f"/api/v1/prescriptions/{prescription.pk}/{endpoint}/")
    assert response.status_code == expected
    if expected == 403:
        assert response["Content-Type"] != "application/pdf"
        assert not AuditLog.objects.filter(
            action__in=["PRESCRIPTION_PDF_DOWNLOADED", "PRESCRIPTION_PRINT_VIEWED"]
        ).exists()


@pytest.mark.django_db
def test_pdf_requires_authentication_and_supports_httponly_login(prescription, doctor_user):
    client = APIClient(enforce_csrf_checks=True)
    url = f"/api/v1/prescriptions/{prescription.pk}/pdf/"
    assert client.get(url).status_code == 401
    csrf = client.get("/api/v1/auth/csrf/").cookies[settings.CSRF_COOKIE_NAME].value
    login = client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "safe-test-password"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf,
    )
    assert login.status_code == 200
    assert login.cookies[settings.AUTH_ACCESS_COOKIE_NAME]["httponly"]
    assert client.get(url).status_code == 200
    assert client.get("/api/v1/prescriptions/999999/pdf/").status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "state,label", [("DRAFT", "BROUILLON"), ("CANCELLED", "ANNULÉE"), ("COMPLETED", "Terminée")]
)
def test_all_saved_statuses_export_without_changing_status(api_client, prescription, state, label):
    prescription.status = state
    prescription.save()
    response = api_client.get(f"/api/v1/prescriptions/{prescription.pk}/pdf/")
    assert response.status_code == 200
    assert label in PdfReader(BytesIO(response.content)).pages[0].extract_text()
    prescription.refresh_from_db()
    assert prescription.status == state


@pytest.mark.django_db
def test_long_prescription_wraps_and_paginates_without_losing_medical_text(
    api_client, prescription
):
    for index in range(25):
        PrescriptionItem.objects.create(
            prescription=prescription,
            medication_name=f"TEST médicament supplémentaire {index:02d}",
            dosage="TEST dose",
            frequency="TEST fréquence",
            duration="TEST durée",
            quantity=index + 1,
            instructions="TEST instructions longues enregistrées. " * 8,
        )
    prescription.general_instructions = "TEST fin de document. " * 80
    prescription.save()
    response = api_client.get(f"/api/v1/prescriptions/{prescription.pk}/pdf/")
    assert response.status_code == 200
    reader = PdfReader(BytesIO(response.content))
    assert len(reader.pages) > 1
    text = "\n".join(page.extract_text() for page in reader.pages)
    for index in range(25):
        assert f"TEST médicament supplémentaire {index:02d}" in text
    assert "Signature et cachet" in reader.pages[-1].extract_text()
    assert text.count("TEST fin de document.") == 80
    for index, page in enumerate(reader.pages, 1):
        page_text = page.extract_text()
        assert f"Page {index}" in page_text
        assert "Dr Nait Abdesselam Gaya" in page_text
        assert "0668 39 82 52" in page_text
        assert "Chirurgien plastique & esthétique" in page_text
        assert page.images
    # Optional visual QA writes only this isolated, fictitious test fixture.
    if folder := os.getenv("PRESCRIPTION_PDF_QA_DIR"):
        Path(folder).mkdir(parents=True, exist_ok=True)
        (Path(folder) / "ordonnance-test-longue.pdf").write_bytes(response.content)
