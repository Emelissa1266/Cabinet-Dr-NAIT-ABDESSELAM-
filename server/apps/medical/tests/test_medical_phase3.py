from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from apps.audit.models import AuditLog
from apps.medical.models import Consultation, MedicalInstruction, Prescription
from apps.patients.models import Patient


@pytest.fixture
def patient(db, doctor_user):
    return Patient.objects.create(
        first_name="Phase",
        last_name="Three",
        created_by=doctor_user,
        updated_by=doctor_user,
    )


@pytest.fixture
def consultation_payload(patient):
    return {
        "patient": patient.id,
        "consultation_date": timezone.now().isoformat(),
        "consultation_type": "INITIAL",
        "reason": "Aesthetic consultation",
        "patient_complaint": "Skin concern",
        "clinical_findings": "Stable examination",
        "diagnosis": "Benign condition",
        "treatment_plan": "Clinical follow-up",
        "recommendations": "Hydration",
        "notes": "Doctor note",
        "status": "DRAFT",
    }


@pytest.mark.django_db
def test_doctor_create_update_and_complete_consultation(api_client, doctor_user, consultation_payload):
    api_client.force_authenticate(user=doctor_user)

    create = api_client.post("/api/v1/consultations/", consultation_payload, format="json")
    assert create.status_code == status.HTTP_201_CREATED
    assert create.data["doctor"] == doctor_user.id
    assert AuditLog.objects.filter(action="CONSULTATION_CREATED").count() == 1

    patch = api_client.patch(
        f"/api/v1/consultations/{create.data['id']}/",
        {"status": "COMPLETED", "diagnosis": "Updated by doctor"},
        format="json",
    )

    assert patch.status_code == status.HTTP_200_OK
    assert patch.data["diagnosis"] == "Updated by doctor"
    assert AuditLog.objects.filter(action="CONSULTATION_COMPLETED").count() == 1


@pytest.mark.django_db
def test_consultation_filtering_and_nurse_read(api_client, doctor_user, nurse_user, patient, consultation_payload):
    api_client.force_authenticate(user=doctor_user)
    first = api_client.post("/api/v1/consultations/", consultation_payload, format="json")
    second_payload = {
        **consultation_payload,
        "status": "COMPLETED",
        "consultation_date": (timezone.now() - timedelta(days=1)).isoformat(),
    }
    api_client.post("/api/v1/consultations/", second_payload, format="json")

    api_client.force_authenticate(user=nurse_user)
    filtered = api_client.get(f"/api/v1/consultations/?patient={patient.id}&status=DRAFT")
    detail = api_client.get(f"/api/v1/consultations/{first.data['id']}/")

    assert filtered.status_code == status.HTTP_200_OK
    assert filtered.data["count"] == 1
    assert detail.status_code == status.HTTP_200_OK
    assert detail.data["diagnosis"] == "Benign condition"


@pytest.mark.django_db
def test_nurse_and_secretary_cannot_modify_consultation(
    api_client,
    doctor_user,
    nurse_user,
    secretary_user,
    consultation_payload,
):
    api_client.force_authenticate(user=doctor_user)
    create = api_client.post("/api/v1/consultations/", consultation_payload, format="json")
    consultation_id = create.data["id"]

    for user in (nurse_user, secretary_user):
        api_client.force_authenticate(user=user)
        response = api_client.patch(
            f"/api/v1/consultations/{consultation_id}/",
            {"diagnosis": f"Changed by {user.role}"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    Consultation.objects.get(pk=consultation_id).refresh_from_db()
    assert Consultation.objects.get(pk=consultation_id).diagnosis == "Benign condition"


@pytest.mark.django_db
def test_doctor_create_and_update_prescription_with_items(
    api_client,
    doctor_user,
    patient,
    consultation_payload,
):
    api_client.force_authenticate(user=doctor_user)
    consultation = api_client.post("/api/v1/consultations/", consultation_payload, format="json")

    payload = {
        "patient": patient.id,
        "consultation": consultation.data["id"],
        "prescribed_at": timezone.now().isoformat(),
        "general_instructions": "Take after meals",
        "notes": "Initial prescription",
        "status": "ACTIVE",
        "items": [
            {
                "medication_name": "Paracetamol",
                "dosage": "500 mg",
                "frequency": "Twice daily",
                "route": "Oral",
                "duration": "3 days",
                "quantity": 6,
                "instructions": "If pain",
            }
        ],
    }
    create = api_client.post("/api/v1/prescriptions/", payload, format="json")
    assert create.status_code == status.HTTP_201_CREATED
    assert create.data["items"][0]["medication_name"] == "Paracetamol"
    assert Prescription.objects.get(pk=create.data["id"]).items.count() == 1

    payload["items"][0]["medication_name"] = "Ibuprofen"
    update = api_client.put(f"/api/v1/prescriptions/{create.data['id']}/", payload, format="json")

    assert update.status_code == status.HTTP_200_OK
    assert update.data["items"][0]["medication_name"] == "Ibuprofen"
    assert AuditLog.objects.filter(action="PRESCRIPTION_UPDATED").count() == 1


@pytest.mark.django_db
def test_prescription_patient_consultation_consistency(api_client, doctor_user, consultation_payload):
    other_patient = Patient.objects.create(first_name="Other", last_name="Patient")
    api_client.force_authenticate(user=doctor_user)
    consultation = api_client.post("/api/v1/consultations/", consultation_payload, format="json")

    response = api_client.post(
        "/api/v1/prescriptions/",
        {
            "patient": other_patient.id,
            "consultation": consultation.data["id"],
            "prescribed_at": timezone.now().isoformat(),
            "status": "ACTIVE",
            "items": [],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert Prescription.objects.count() == 0


@pytest.mark.django_db
def test_nurse_can_read_but_not_modify_prescription(api_client, doctor_user, nurse_user, patient):
    prescription = Prescription.objects.create(
        patient=patient,
        doctor=doctor_user,
        prescribed_at=timezone.now(),
        general_instructions="Doctor instruction",
    )
    api_client.force_authenticate(user=nurse_user)

    detail = api_client.get(f"/api/v1/prescriptions/{prescription.id}/")
    patch = api_client.patch(
        f"/api/v1/prescriptions/{prescription.id}/",
        {"general_instructions": "Nurse changed"},
        format="json",
    )

    prescription.refresh_from_db()
    assert detail.status_code == status.HTTP_200_OK
    assert patch.status_code == status.HTTP_403_FORBIDDEN
    assert prescription.general_instructions == "Doctor instruction"


@pytest.mark.django_db
def test_secretary_cannot_modify_prescription(api_client, doctor_user, secretary_user, patient):
    prescription = Prescription.objects.create(
        patient=patient,
        doctor=doctor_user,
        prescribed_at=timezone.now(),
        general_instructions="Protected",
    )
    api_client.force_authenticate(user=secretary_user)

    response = api_client.patch(
        f"/api/v1/prescriptions/{prescription.id}/",
        {"general_instructions": "Secretary changed"},
        format="json",
    )

    prescription.refresh_from_db()
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert prescription.general_instructions == "Protected"


@pytest.mark.django_db
def test_medical_instruction_doctor_create_update_nurse_read_and_forbidden_alter(
    api_client,
    doctor_user,
    nurse_user,
    patient,
):
    api_client.force_authenticate(user=doctor_user)
    create = api_client.post(
        "/api/v1/medical-instructions/",
        {
            "patient": patient.id,
            "title": "Post-care instruction",
            "instruction": "Monitor wound daily",
            "priority": "HIGH",
            "status": "ACTIVE",
        },
        format="json",
    )
    assert create.status_code == status.HTTP_201_CREATED

    update = api_client.patch(
        f"/api/v1/medical-instructions/{create.data['id']}/",
        {"priority": "URGENT"},
        format="json",
    )
    assert update.status_code == status.HTTP_200_OK

    api_client.force_authenticate(user=nurse_user)
    detail = api_client.get(f"/api/v1/medical-instructions/{create.data['id']}/")
    forbidden = api_client.patch(
        f"/api/v1/medical-instructions/{create.data['id']}/",
        {"instruction": "Nurse rewrite"},
        format="json",
    )

    instruction = MedicalInstruction.objects.get(pk=create.data["id"])
    assert detail.status_code == status.HTTP_200_OK
    assert forbidden.status_code == status.HTTP_403_FORBIDDEN
    assert instruction.instruction == "Monitor wound daily"
