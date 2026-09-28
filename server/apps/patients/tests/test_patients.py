import re

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework import status

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.patients.models import (
    Patient,
    PatientAllergy,
    PatientChronicCondition,
    PatientClinicalNote,
    PatientContraindication,
    PatientMedicalHistory,
    PatientMedication,
    PatientSurgicalHistory,
)


@pytest.fixture
def patient(db, doctor_user):
    return Patient.objects.create(
        first_name="Leila",
        last_name="Mansouri",
        phone="+213555000111",
        city="Algiers",
        created_by=doctor_user,
        updated_by=doctor_user,
    )


@pytest.fixture
def patient_with_medical_info(patient, doctor_user):
    PatientAllergy.objects.create(
        patient=patient,
        title="Latex",
        description="Clinical allergy",
        severity="high",
        recorded_by=doctor_user,
    )
    PatientMedicalHistory.objects.create(
        patient=patient,
        title="Asthma",
        description="Childhood asthma",
        recorded_by=doctor_user,
    )
    PatientSurgicalHistory.objects.create(
        patient=patient,
        title="Appendectomy",
        description="Recovered",
        recorded_by=doctor_user,
    )
    PatientChronicCondition.objects.create(
        patient=patient,
        title="Hypertension",
        description="Controlled",
        recorded_by=doctor_user,
    )
    PatientMedication.objects.create(
        patient=patient,
        title="Amlodipine",
        dosage="5 mg",
        frequency="Daily",
        recorded_by=doctor_user,
    )
    PatientContraindication.objects.create(
        patient=patient,
        title="Laser precaution",
        description="Avoid recently irritated zones",
        recorded_by=doctor_user,
    )
    PatientClinicalNote.objects.create(
        patient=patient,
        note="Clinical baseline note",
        recorded_by=doctor_user,
    )
    return patient


@pytest.mark.django_db
def test_patient_model_creation_generates_unique_reference(doctor_user):
    patient = Patient.objects.create(
        first_name="Sarah",
        last_name="Benali",
        created_by=doctor_user,
        updated_by=doctor_user,
    )

    assert re.fullmatch(r"P-\d{5}", patient.patient_reference)
    assert patient.patient_reference == f"P-{patient.pk:05d}"
    assert patient.created_by == doctor_user
    assert patient.updated_by == doctor_user


@pytest.mark.django_db
def test_patient_reference_generation_supports_expected_format_like_p_00254(doctor_user):
    patient = Patient(id=254, first_name="Sarah", last_name="Benali", created_by=doctor_user)
    patient.save(force_insert=True)

    assert patient.patient_reference == "P-00254"


@pytest.mark.django_db
def test_duplicate_patient_reference_is_prevented(doctor_user):
    Patient.objects.create(
        patient_reference="P-00254",
        first_name="Sarah",
        last_name="Benali",
        created_by=doctor_user,
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        Patient.objects.create(
            patient_reference="P-00254",
            first_name="Nadia",
            last_name="Ouali",
            created_by=doctor_user,
        )


@pytest.mark.django_db
def test_patient_required_fields_are_enforced_at_model_validation():
    patient = Patient(first_name="", last_name="")

    with pytest.raises(ValidationError) as exc_info:
        patient.full_clean()

    assert "first_name" in exc_info.value.message_dict
    assert "last_name" in exc_info.value.message_dict


@pytest.mark.django_db
def test_patient_medical_and_admin_related_fields_are_persisted(patient_with_medical_info):
    patient = patient_with_medical_info

    assert patient.patientallergys.count() == 1
    assert patient.patientmedicalhistorys.count() == 1
    assert patient.patientsurgicalhistorys.count() == 1
    assert patient.patientchronicconditions.count() == 1
    assert patient.patientmedications.count() == 1
    assert patient.patientcontraindications.count() == 1
    assert patient.clinical_notes.count() == 1
    assert patient.phone == "+213555000111"
    assert patient.city == "Algiers"


@pytest.mark.django_db
def test_patient_api_requires_authentication(api_client):
    response = api_client.get("/api/v1/patients/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_patient_api_create_retrieve_update_partial_update_and_delete(
    api_client,
    doctor_user,
    patient_payload,
):
    api_client.force_authenticate(user=doctor_user)

    create = api_client.post("/api/v1/patients/", patient_payload, format="json")
    assert create.status_code == status.HTTP_201_CREATED
    assert create.data["created_by"] == doctor_user.id
    assert create.data["updated_by"] == doctor_user.id
    assert create.data["patient_reference"].startswith("P-")
    assert Patient.objects.filter(pk=create.data["id"]).exists()

    retrieve = api_client.get(f"/api/v1/patients/{create.data['id']}/")
    assert retrieve.status_code == status.HTTP_200_OK
    assert retrieve.data["first_name"] == patient_payload["first_name"]
    assert retrieve.data["medical_information"] is not None

    put_payload = {**patient_payload, "city": "Oran", "phone": "+213555777888"}
    update = api_client.put(f"/api/v1/patients/{create.data['id']}/", put_payload, format="json")
    assert update.status_code == status.HTTP_200_OK
    assert update.data["city"] == "Oran"

    partial = api_client.patch(
        f"/api/v1/patients/{create.data['id']}/",
        {"profession": "Engineer"},
        format="json",
    )
    assert partial.status_code == status.HTTP_200_OK
    assert partial.data["profession"] == "Engineer"

    delete = api_client.delete(f"/api/v1/patients/{create.data['id']}/")
    assert delete.status_code == status.HTTP_204_NO_CONTENT
    assert not Patient.objects.filter(pk=create.data["id"]).exists()


@pytest.mark.django_db
def test_patient_api_rejects_missing_required_fields(api_client, doctor_user):
    api_client.force_authenticate(user=doctor_user)

    response = api_client.post(
        "/api/v1/patients/",
        {"last_name": "Benali"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "first_name" in response.data
    assert Patient.objects.count() == 0


@pytest.mark.django_db
def test_patient_api_pagination_search_filtering_and_ordering(api_client, doctor_user):
    Patient.objects.create(first_name="Sarah", last_name="Benali", city="Algiers", phone="111")
    Patient.objects.create(first_name="Karim", last_name="Ouali", city="Oran", phone="222")
    Patient.objects.create(first_name="Nadia", last_name="Ziani", city="Algiers", phone="333")
    api_client.force_authenticate(user=doctor_user)

    page = api_client.get("/api/v1/patients/?page=1")
    assert page.status_code == status.HTTP_200_OK
    assert page.data["count"] == 3
    assert "results" in page.data

    search_by_name = api_client.get("/api/v1/patients/?search=Sarah")
    assert search_by_name.data["count"] == 1
    assert search_by_name.data["results"][0]["first_name"] == "Sarah"

    search_by_reference = api_client.get(
        f"/api/v1/patients/?search={search_by_name.data['results'][0]['patient_reference']}"
    )
    assert search_by_reference.data["count"] == 1

    search_by_phone = api_client.get("/api/v1/patients/?search=222")
    assert search_by_phone.data["count"] == 1
    assert search_by_phone.data["results"][0]["phone"] == "222"

    filtered = api_client.get("/api/v1/patients/?city=Algiers")
    assert filtered.data["count"] == 2

    ordered = api_client.get("/api/v1/patients/?ordering=last_name")
    assert [item["last_name"] for item in ordered.data["results"]] == [
        "Benali",
        "Ouali",
        "Ziani",
    ]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role",
    (User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY),
)
def test_role_can_list_and_retrieve_patients(
    api_client,
    make_user,
    patient_with_medical_info,
    role,
):
    user = make_user(role=role, username=f"list-{role.lower()}")
    api_client.force_authenticate(user=user)

    list_response = api_client.get("/api/v1/patients/")
    detail_response = api_client.get(f"/api/v1/patients/{patient_with_medical_info.id}/")

    assert list_response.status_code == status.HTTP_200_OK
    assert detail_response.status_code == status.HTTP_200_OK
    if role == User.Role.SECRETARY:
        assert detail_response.data["medical_information"] is None
    else:
        assert detail_response.data["medical_information"]["allergies"][0]["title"] == "Latex"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role",
    (User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY),
)
def test_role_create_and_update_permissions_match_phase_2_matrix(
    api_client,
    make_user,
    patient_payload,
    role,
):
    user = make_user(role=role, username=f"create-{role.lower()}")
    api_client.force_authenticate(user=user)

    create = api_client.post("/api/v1/patients/", patient_payload, format="json")
    assert create.status_code == status.HTTP_201_CREATED
    assert create.data["created_by"] == user.id

    patch = api_client.patch(
        f"/api/v1/patients/{create.data['id']}/",
        {"phone": "+213555999888"},
        format="json",
    )
    assert patch.status_code == status.HTTP_200_OK
    assert Patient.objects.get(pk=create.data["id"]).phone == "+213555999888"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role", "expected_status"),
    (
        (User.Role.ADMIN, status.HTTP_204_NO_CONTENT),
        (User.Role.DOCTOR, status.HTTP_204_NO_CONTENT),
        (User.Role.NURSE, status.HTTP_403_FORBIDDEN),
        (User.Role.SECRETARY, status.HTTP_403_FORBIDDEN),
    ),
)
def test_delete_permissions_do_not_modify_database_when_forbidden(
    api_client,
    make_user,
    patient,
    role,
    expected_status,
):
    user = make_user(role=role, username=f"delete-{role.lower()}")
    api_client.force_authenticate(user=user)
    before_count = Patient.objects.count()

    response = api_client.delete(f"/api/v1/patients/{patient.id}/")

    assert response.status_code == expected_status
    if expected_status == status.HTTP_403_FORBIDDEN:
        assert Patient.objects.count() == before_count
        assert Patient.objects.filter(pk=patient.id).exists()
        assert not AuditLog.objects.filter(action="PATIENT_DELETED", entity_id=patient.id).exists()
    else:
        assert Patient.objects.count() == before_count - 1


@pytest.mark.django_db
def test_secretary_cannot_modify_protected_medical_information(
    api_client,
    secretary_user,
    patient_with_medical_info,
):
    patient = patient_with_medical_info
    api_client.force_authenticate(user=secretary_user)
    allergy_before = PatientAllergy.objects.get(patient=patient)

    response = api_client.patch(
        f"/api/v1/patients/{patient.id}/",
        {
            "notes": "Updated administrative note",
            "medical_information": {
                "allergies": [{"id": allergy_before.id, "title": "Changed"}],
            },
        },
        format="json",
    )

    allergy_before.refresh_from_db()
    patient.refresh_from_db()
    assert response.status_code == status.HTTP_200_OK
    assert patient.notes == "Updated administrative note"
    assert allergy_before.title == "Latex"
    assert response.data["medical_information"] is None


@pytest.mark.django_db
def test_inactive_user_cannot_modify_patient_database_state(api_client, make_user, patient):
    inactive_user = make_user(
        role=User.Role.DOCTOR,
        username="inactive-patient-user",
        is_active=False,
    )
    api_client.force_authenticate(user=inactive_user)

    response = api_client.patch(
        f"/api/v1/patients/{patient.id}/",
        {"city": "Constantine"},
        format="json",
    )

    patient.refresh_from_db()
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert patient.city == "Algiers"


@pytest.mark.django_db
def test_patient_create_update_delete_generate_audit_events(
    api_client,
    doctor_user,
    patient_payload,
):
    api_client.force_authenticate(user=doctor_user)

    create = api_client.post("/api/v1/patients/", patient_payload, format="json")
    patient_id = create.data["id"]
    api_client.patch(f"/api/v1/patients/{patient_id}/", {"city": "Oran"}, format="json")
    api_client.delete(f"/api/v1/patients/{patient_id}/")

    created = AuditLog.objects.get(action="PATIENT_CREATED", entity_id=str(patient_id))
    updated = AuditLog.objects.get(action="PATIENT_UPDATED", entity_id=str(patient_id))
    deleted = AuditLog.objects.get(action="PATIENT_DELETED", entity_id=str(patient_id))

    assert created.user == doctor_user
    assert created.role == User.Role.DOCTOR
    assert created.new_data["patient_reference"].startswith("P-")
    assert updated.old_data["city"] == "Algiers"
    assert updated.new_data["city"] == "Oran"
    assert deleted.old_data["id"] == patient_id
