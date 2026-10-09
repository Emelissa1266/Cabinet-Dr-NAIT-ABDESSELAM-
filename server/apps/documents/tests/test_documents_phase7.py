import shutil
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.care.models import Care, CareCategory, CareSession, CareType
from apps.documents.models import (
    ClinicalPhoto,
    ClinicalPhotoComparison,
    ClinicalPhotoSet,
    Document,
    DocumentCategory,
)
from apps.documents.storage import private_media_storage
from apps.medical.models import Consultation, Prescription
from apps.patients.models import Patient
from apps.surgery.models import PreoperativeRequirement, Surgery, SurgeryConsent

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def private_storage(tmp_path, settings):
    settings.PRIVATE_MEDIA_ROOT = tmp_path
    private_media_storage._location = str(tmp_path)
    private_media_storage._base_url = None
    yield tmp_path
    shutil.rmtree(tmp_path, ignore_errors=True)


@pytest.fixture
def patient(secretary_user):
    return Patient.objects.create(first_name="Docs", last_name="Patient", created_by=secretary_user)


@pytest.fixture
def other_patient():
    return Patient.objects.create(first_name="Other", last_name="Patient")


@pytest.fixture
def categories():
    return {
        "clinical": DocumentCategory.objects.create(code="medical-report", name="Medical report", system_type="CLINICAL"),
        "admin": DocumentCategory.objects.create(code="identity", name="Identity", system_type="ADMINISTRATIVE"),
        "consent": DocumentCategory.objects.create(code="consent", name="Consent", system_type="CONSENT"),
    }


def pdf_file(name="report.pdf", content=b"%PDF-1.4\nphase7\n%%EOF"):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


def image_file(name="photo.jpg", image_format="JPEG"):
    buffer = BytesIO()
    Image.new("RGB", (8, 6), color=(20, 80, 120)).save(buffer, format=image_format)
    content_type = "image/png" if image_format == "PNG" else "image/jpeg"
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=content_type)


def upload_document(api_client, user, patient, category, **overrides):
    api_client.force_authenticate(user=user)
    payload = {
        "patient": patient.id,
        "category": category.id,
        "title": "Uploaded document",
        "file": pdf_file(overrides.pop("filename", "report.pdf")),
    }
    payload.update(overrides)
    return api_client.post("/api/v1/documents/", payload, format="multipart")


def upload_photo(api_client, user, patient, **overrides):
    api_client.force_authenticate(user=user)
    payload = {
        "patient": patient.id,
        "photo_type": ClinicalPhoto.PhotoType.BEFORE,
        "anatomical_area": "NOSE",
        "view_angle": ClinicalPhoto.ViewAngle.FRONT,
        "image": image_file(),
    }
    payload.update(overrides)
    return api_client.post("/api/v1/clinical-photos/", payload, format="multipart")


def assign_nurse_care(patient, nurse_user):
    category = CareCategory.objects.create(name=f"Post-op care {patient.id}")
    care_type = CareType.objects.create(category=category, name="Dressing")
    return Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=nurse_user,
        assigned_nurse=nurse_user,
        start_date=timezone.localdate(),
        planned_sessions=1,
    )


def test_valid_document_upload_metadata_safe_path_download_and_audit(api_client, doctor_user, patient, categories):
    response = upload_document(api_client, doctor_user, patient, categories["clinical"], filename="../secret.pdf")
    document = Document.objects.get()
    download = api_client.get(f"/api/v1/documents/{document.id}/download/")
    view = api_client.get(f"/api/v1/documents/{document.id}/view/")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["original_filename"] == "secret.pdf"
    assert response.data["mime_type"] == "application/pdf"
    assert response.data["file_size"] > 0
    assert len(response.data["checksum"]) == 64
    assert document.uploaded_by == doctor_user
    assert document.stored_filename.startswith("secure/documents/")
    assert "secret.pdf" not in document.stored_filename
    assert download.status_code == status.HTTP_200_OK
    assert download["Content-Type"] == "application/pdf"
    assert "attachment" in download["Content-Disposition"]
    assert download["X-Content-Type-Options"] == "nosniff"
    assert download["Cache-Control"] == "no-store, private"
    assert download["Pragma"] == "no-cache"
    assert download["Referrer-Policy"] == "no-referrer"
    assert "inline" in view["Content-Disposition"]
    assert AuditLog.objects.filter(action="DOCUMENT_UPLOADED").exists()
    assert AuditLog.objects.filter(action="DOCUMENT_DOWNLOADED").exists()
    assert AuditLog.objects.filter(action="DOCUMENT_VIEWED").exists()


@override_settings(DOCUMENT_MAX_UPLOAD_SIZE=8)
def test_invalid_uploads_are_rejected_without_records(api_client, doctor_user, patient, categories):
    api_client.force_authenticate(user=doctor_user)
    oversized = api_client.post(
        "/api/v1/documents/",
        {
            "patient": patient.id,
            "category": categories["clinical"].id,
            "title": "Too large",
            "file": pdf_file(content=b"%PDF-1.4\nlarge-pdf\n%%EOF"),
        },
        format="multipart",
    )
    executable = api_client.post(
        "/api/v1/documents/",
        {
            "patient": patient.id,
            "category": categories["clinical"].id,
            "title": "Executable",
            "file": SimpleUploadedFile("bad.exe", b"MZ\x00\x00", content_type="application/pdf"),
        },
        format="multipart",
    )
    fake_image = api_client.post(
        "/api/v1/clinical-photos/",
        {
            "patient": patient.id,
            "photo_type": ClinicalPhoto.PhotoType.BEFORE,
            "anatomical_area": "NOSE",
            "image": SimpleUploadedFile("fake.jpg", b"not an image", content_type="image/jpeg"),
        },
        format="multipart",
    )

    assert oversized.status_code == status.HTTP_400_BAD_REQUEST
    assert executable.status_code == status.HTTP_400_BAD_REQUEST
    assert fake_image.status_code == status.HTTP_400_BAD_REQUEST
    assert Document.objects.count() == 0
    assert ClinicalPhoto.objects.count() == 0


def test_document_relationship_patient_consistency_and_consent_separation(
    api_client,
    doctor_user,
    patient,
    other_patient,
    categories,
):
    consultation = Consultation.objects.create(patient=other_patient, doctor=doctor_user, consultation_date=timezone.now(), reason="Mismatch")
    surgery = Surgery.objects.create(patient=patient, surgeon=doctor_user, procedure_name="Procedure", indication="Indication")
    consent = SurgeryConsent.objects.create(surgery=surgery, consent_type="Surgical consent")
    preop = PreoperativeRequirement.objects.create(surgery=surgery, name="Lab result")
    prescription = Prescription.objects.create(patient=patient, doctor=doctor_user, prescribed_at=timezone.now())

    mismatch = upload_document(api_client, doctor_user, patient, categories["clinical"], consultation=consultation.id)
    wrong_category = upload_document(api_client, doctor_user, patient, categories["clinical"], surgery_consent=consent.id)
    consent_doc = upload_document(
        api_client,
        doctor_user,
        patient,
        categories["consent"],
        surgery=surgery.id,
        surgery_consent=consent.id,
        preoperative_requirement=preop.id,
        prescription=prescription.id,
    )
    consent.refresh_from_db()

    assert mismatch.status_code == status.HTTP_400_BAD_REQUEST
    assert wrong_category.status_code == status.HTTP_400_BAD_REQUEST
    assert consent_doc.status_code == status.HTTP_201_CREATED
    assert consent.status == SurgeryConsent.Status.PENDING


def test_archive_behavior_and_default_list_excludes_archived(api_client, doctor_user, patient, categories):
    response = upload_document(api_client, doctor_user, patient, categories["clinical"])
    document_id = response.data["id"]
    archived = api_client.post(f"/api/v1/documents/{document_id}/archive/", {"reason": "Replaced"}, format="json")
    repeated = api_client.post(f"/api/v1/documents/{document_id}/archive/", {"reason": "Again"}, format="json")
    active_list = api_client.get("/api/v1/documents/")
    archived_list = api_client.get("/api/v1/documents/?is_archived=true")
    hard_delete = api_client.delete(f"/api/v1/documents/{document_id}/")
    document = Document.objects.get(pk=document_id)

    assert archived.status_code == status.HTTP_200_OK
    assert document.is_archived is True
    assert document.archived_by == doctor_user
    assert document.archived_at is not None
    assert document.archive_reason == "Replaced"
    assert repeated.status_code == status.HTTP_400_BAD_REQUEST
    assert active_list.data["count"] == 0
    assert archived_list.data["count"] == 1
    assert hard_delete.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    assert AuditLog.objects.filter(action="DOCUMENT_ARCHIVED").exists()


def test_clinical_photo_upload_metadata_download_archive_and_secretary_denial(
    api_client,
    doctor_user,
    secretary_user,
    patient,
):
    response = upload_photo(api_client, doctor_user, patient, image=image_file("nose.png", "PNG"))
    photo = ClinicalPhoto.objects.get()
    download = api_client.get(f"/api/v1/clinical-photos/{photo.id}/download/")
    archived = api_client.post(f"/api/v1/clinical-photos/{photo.id}/archive/", {"reason": "Older set"}, format="json")
    api_client.force_authenticate(user=secretary_user)
    secretary_read = api_client.get(f"/api/v1/clinical-photos/{photo.id}/")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["mime_type"] == "image/png"
    assert response.data["width"] == 8
    assert response.data["height"] == 6
    assert photo.stored_filename.startswith("secure/clinical-photos/")
    assert download["X-Content-Type-Options"] == "nosniff"
    assert download["Cache-Control"] == "no-store, private"
    assert archived.status_code == status.HTTP_200_OK
    assert secretary_read.status_code == status.HTTP_403_FORBIDDEN
    assert AuditLog.objects.filter(action="CLINICAL_PHOTO_UPLOADED").exists()
    assert AuditLog.objects.filter(action="CLINICAL_PHOTO_DOWNLOADED").exists()
    assert AuditLog.objects.filter(action="CLINICAL_PHOTO_ARCHIVED").exists()


def test_photo_set_and_comparison_validation(api_client, doctor_user, patient, other_patient):
    surgery = Surgery.objects.create(patient=patient, surgeon=doctor_user, procedure_name="Rhinoplasty", indication="Indication")
    other_surgery = Surgery.objects.create(patient=other_patient, surgeon=doctor_user, procedure_name="Other", indication="Other")
    api_client.force_authenticate(user=doctor_user)
    photo_set = api_client.post(
        "/api/v1/clinical-photo-sets/",
        {"patient": patient.id, "surgery": surgery.id, "title": "Pre-op", "anatomical_area": "NOSE"},
        format="json",
    )
    mismatch_set = api_client.post(
        "/api/v1/clinical-photo-sets/",
        {"patient": patient.id, "surgery": other_surgery.id, "title": "Bad", "anatomical_area": "NOSE"},
        format="json",
    )
    before = upload_photo(api_client, doctor_user, patient, surgery=surgery.id, photo_set=photo_set.data["id"])
    after = upload_photo(
        api_client,
        doctor_user,
        patient,
        surgery=surgery.id,
        photo_type=ClinicalPhoto.PhotoType.AFTER,
        image=image_file("after.jpg"),
    )
    valid = api_client.post(
        "/api/v1/clinical-photo-comparisons/",
        {
            "patient": patient.id,
            "surgery": surgery.id,
            "before_photo": before.data["id"],
            "after_photo": after.data["id"],
        },
        format="json",
    )
    invalid = api_client.post(
        "/api/v1/clinical-photo-comparisons/",
        {
            "patient": patient.id,
            "before_photo": after.data["id"],
            "after_photo": before.data["id"],
        },
        format="json",
    )

    assert photo_set.status_code == status.HTTP_201_CREATED
    assert mismatch_set.status_code == status.HTTP_400_BAD_REQUEST
    assert valid.status_code == status.HTTP_201_CREATED
    assert invalid.status_code == status.HTTP_400_BAD_REQUEST
    assert ClinicalPhotoSet.objects.count() == 1
    assert ClinicalPhotoComparison.objects.count() == 1
    assert AuditLog.objects.filter(action="CLINICAL_PHOTO_COMPARISON_CREATED").exists()


def test_empty_photo_set_can_be_created_then_receive_photos_without_weakening_security(
    api_client,
    doctor_user,
    secretary_user,
    patient,
):
    api_client.force_authenticate(user=doctor_user)
    payload = {
        "patient": patient.id,
        "title": "Suivi postopératoire",
        "anatomical_area": "Visage",
        "captured_at": timezone.now().isoformat(),
        "notes": "Contrôle d'évolution",
    }
    photo_set = api_client.post("/api/v1/clinical-photo-sets/", payload, format="json")

    assert photo_set.status_code == status.HTTP_201_CREATED
    persisted_set = ClinicalPhotoSet.objects.get(pk=photo_set.data["id"])
    assert persisted_set.photos.count() == 0
    assert persisted_set.created_by == doctor_user

    attached = upload_photo(api_client, doctor_user, patient, photo_set=photo_set.data["id"], image=image_file("attached.png", "PNG"))
    standalone = upload_photo(api_client, doctor_user, patient, photo_set="", image=image_file("standalone.png", "PNG"))
    invalid = api_client.post(
        "/api/v1/clinical-photos/",
        {
            "patient": patient.id,
            "photo_set": photo_set.data["id"],
            "photo_type": ClinicalPhoto.PhotoType.AFTER,
            "anatomical_area": "Visage",
            "image": SimpleUploadedFile("bad.jpg", b"not an image", content_type="image/jpeg"),
        },
        format="multipart",
    )
    persisted_set.refresh_from_db()
    attached_photo = ClinicalPhoto.objects.get(pk=attached.data["id"])
    standalone_photo = ClinicalPhoto.objects.get(pk=standalone.data["id"])
    view = api_client.get(f"/api/v1/clinical-photos/{attached_photo.id}/view/")
    api_client.force_authenticate(user=None)
    anonymous_view = api_client.get(f"/api/v1/clinical-photos/{attached_photo.id}/view/")
    anonymous_create = api_client.post("/api/v1/clinical-photo-sets/", payload, format="json")
    api_client.force_authenticate(user=secretary_user)
    secretary_create = api_client.post("/api/v1/clinical-photo-sets/", payload, format="json")

    assert attached.status_code == status.HTTP_201_CREATED
    assert attached_photo.photo_set == persisted_set
    assert persisted_set.photos.count() == 1
    assert standalone.status_code == status.HTTP_201_CREATED
    assert standalone_photo.photo_set is None
    assert invalid.status_code == status.HTTP_400_BAD_REQUEST
    assert persisted_set.photos.count() == 1
    assert view.status_code == status.HTTP_200_OK
    assert view["X-Content-Type-Options"] == "nosniff"
    assert anonymous_view.status_code == status.HTTP_401_UNAUTHORIZED
    assert anonymous_create.status_code == status.HTTP_401_UNAUTHORIZED
    assert secretary_create.status_code == status.HTTP_403_FORBIDDEN


def test_photo_set_patient_filter_returns_patient_records_independent_of_creator_and_without_photos(
    api_client,
    admin_user,
    doctor_user,
    nurse_user,
    secretary_user,
    make_user,
    patient,
    other_patient,
):
    assign_nurse_care(patient, nurse_user)
    other_doctor = make_user(role=User.Role.DOCTOR, username="photo-set-other-doctor")
    face_set = ClinicalPhotoSet.objects.create(
        patient=patient,
        title="Suivi postopératoire",
        anatomical_area="Visage",
        created_by=doctor_user,
    )
    abdomen_set = ClinicalPhotoSet.objects.create(
        patient=patient,
        title="Cicatrisation",
        anatomical_area="Abdomen",
        created_by=other_doctor,
    )
    other_patient_set = ClinicalPhotoSet.objects.create(
        patient=other_patient,
        title="Autre patient",
        anatomical_area="Visage",
        created_by=other_doctor,
    )

    for user in (admin_user, doctor_user, nurse_user):
        api_client.force_authenticate(user=user)
        response = api_client.get(f"/api/v1/clinical-photo-sets/?patient={patient.id}")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2
        assert {item["id"] for item in response.data["results"]} == {face_set.id, abdomen_set.id}
        assert other_patient_set.id not in {item["id"] for item in response.data["results"]}

    api_client.force_authenticate(user=nurse_user)
    nurse_response = api_client.get(f"/api/v1/clinical-photo-sets/?patient={patient.id}")
    returned_face_set = next(item for item in nurse_response.data["results"] if item["id"] == face_set.id)
    returned_abdomen_set = next(item for item in nurse_response.data["results"] if item["id"] == abdomen_set.id)

    assert returned_face_set["created_by"] == doctor_user.id
    assert returned_abdomen_set["created_by"] == other_doctor.id
    assert returned_face_set["consultation"] is None
    assert returned_face_set["surgery"] is None
    assert face_set.photos.count() == 0
    assert abdomen_set.photos.count() == 0

    api_client.force_authenticate(user=None)
    anonymous = api_client.get(f"/api/v1/clinical-photo-sets/?patient={patient.id}")
    api_client.force_authenticate(user=secretary_user)
    secretary = api_client.get(f"/api/v1/clinical-photo-sets/?patient={patient.id}")

    assert anonymous.status_code == status.HTTP_401_UNAUTHORIZED
    assert secretary.status_code == status.HTTP_403_FORBIDDEN


def test_clinical_photo_security_remains_after_patient_scoped_photo_set_listing(
    api_client,
    nurse_user,
    secretary_user,
    patient,
    other_patient,
):
    assign_nurse_care(patient, nurse_user)
    photo_set = ClinicalPhotoSet.objects.create(
        patient=patient,
        title="Suivi postopératoire",
        anatomical_area="Visage",
        created_by=nurse_user,
    )

    cross_patient = upload_photo(
        api_client,
        nurse_user,
        other_patient,
        photo_set=photo_set.id,
        image=image_file("cross-patient.png", "PNG"),
    )
    attached = upload_photo(
        api_client,
        nurse_user,
        patient,
        photo_set=photo_set.id,
        image=image_file("attached.png", "PNG"),
    )
    photo = ClinicalPhoto.objects.get(pk=attached.data["id"])
    nurse_view = api_client.get(f"/api/v1/clinical-photos/{photo.id}/view/")
    api_client.force_authenticate(user=None)
    anonymous_view = api_client.get(f"/api/v1/clinical-photos/{photo.id}/view/")
    api_client.force_authenticate(user=secretary_user)
    secretary_view = api_client.get(f"/api/v1/clinical-photos/{photo.id}/view/")

    assert cross_patient.status_code == status.HTTP_400_BAD_REQUEST
    assert attached.status_code == status.HTTP_201_CREATED
    assert photo.photo_set == photo_set
    assert nurse_view.status_code == status.HTTP_200_OK
    assert anonymous_view.status_code == status.HTTP_401_UNAUTHORIZED
    assert secretary_view.status_code == status.HTTP_403_FORBIDDEN


def test_nurse_clinical_photo_access_is_limited_to_care_relevant_patients(
    api_client,
    doctor_user,
    nurse_user,
    patient,
    other_patient,
):
    assign_nurse_care(patient, nurse_user)
    allowed_set = ClinicalPhotoSet.objects.create(
        patient=patient,
        title="Care relevant",
        anatomical_area="Face",
        created_by=doctor_user,
    )
    unrelated_set = ClinicalPhotoSet.objects.create(
        patient=other_patient,
        title="Unrelated",
        anatomical_area="Face",
        created_by=doctor_user,
    )
    allowed_photo = upload_photo(api_client, doctor_user, patient, photo_set=allowed_set.id)
    unrelated_photo = upload_photo(api_client, doctor_user, other_patient, photo_set=unrelated_set.id)

    api_client.force_authenticate(user=nurse_user)
    listed_sets = api_client.get("/api/v1/clinical-photo-sets/")
    allowed_view = api_client.get(f"/api/v1/clinical-photos/{allowed_photo.data['id']}/view/")
    unrelated_set_read = api_client.get(f"/api/v1/clinical-photo-sets/{unrelated_set.id}/")
    unrelated_photo_view = api_client.get(f"/api/v1/clinical-photos/{unrelated_photo.data['id']}/view/")
    unrelated_set_create = api_client.post(
        "/api/v1/clinical-photo-sets/",
        {"patient": other_patient.id, "title": "Bad", "anatomical_area": "Face"},
        format="json",
    )
    unrelated_photo_create = upload_photo(api_client, nurse_user, other_patient)

    assert listed_sets.status_code == status.HTTP_200_OK
    assert {item["id"] for item in listed_sets.data["results"]} == {allowed_set.id}
    assert allowed_view.status_code == status.HTTP_200_OK
    assert unrelated_set_read.status_code == status.HTTP_404_NOT_FOUND
    assert unrelated_photo_view.status_code == status.HTTP_404_NOT_FOUND
    assert unrelated_set_create.status_code == status.HTTP_400_BAD_REQUEST
    assert unrelated_photo_create.status_code == status.HTTP_400_BAD_REQUEST


def test_rbac_doctor_nurse_secretary_and_admin(
    api_client,
    admin_user,
    doctor_user,
    nurse_user,
    secretary_user,
    patient,
    other_patient,
    categories,
):
    category = CareCategory.objects.create(name="Post-op")
    care_type = CareType.objects.create(category=category, name="Dressing")
    care = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=nurse_user,
        start_date=timezone.localdate(),
        planned_sessions=1,
    )
    CareSession.objects.create(care=care, nurse=nurse_user)
    clinical_doc = upload_document(api_client, doctor_user, patient, categories["clinical"], care=care.id)
    admin_doc = upload_document(api_client, secretary_user, patient, categories["admin"])
    secretary_clinical = upload_document(api_client, secretary_user, patient, categories["clinical"])
    unrelated_doc = upload_document(api_client, doctor_user, other_patient, categories["clinical"])

    api_client.force_authenticate(user=nurse_user)
    nurse_allowed = api_client.get(f"/api/v1/documents/{clinical_doc.data['id']}/download/")
    nurse_denied = api_client.get(f"/api/v1/documents/{unrelated_doc.data['id']}/download/")
    nurse_archive_denied = api_client.post(
        f"/api/v1/documents/{unrelated_doc.data['id']}/archive/",
        {"reason": "No access"},
        format="json",
    )
    api_client.force_authenticate(user=secretary_user)
    secretary_allowed = api_client.get(f"/api/v1/documents/{admin_doc.data['id']}/download/")
    secretary_denied = api_client.get(f"/api/v1/documents/{clinical_doc.data['id']}/download/")
    api_client.force_authenticate(user=admin_user)
    category_create = api_client.post(
        "/api/v1/document-categories/",
        {"code": "lab-result", "name": "Lab result", "system_type": "CLINICAL"},
        format="json",
    )
    unrelated = Document.objects.get(pk=unrelated_doc.data["id"])

    assert secretary_clinical.status_code == status.HTTP_400_BAD_REQUEST
    assert nurse_allowed.status_code == status.HTTP_200_OK
    assert nurse_denied.status_code == status.HTTP_404_NOT_FOUND
    assert nurse_archive_denied.status_code == status.HTTP_404_NOT_FOUND
    assert secretary_allowed.status_code == status.HTTP_200_OK
    assert secretary_denied.status_code == status.HTTP_404_NOT_FOUND
    assert category_create.status_code == status.HTTP_201_CREATED
    assert AuditLog.objects.filter(
        action="DOCUMENT_CATEGORY_CREATED",
        entity_id=str(category_create.data["id"]),
    ).exists()
    unrelated.refresh_from_db()
    assert unrelated.is_archived is False


def test_inactive_category_and_unauthenticated_download_rejected(api_client, doctor_user, patient, categories):
    categories["clinical"].is_active = False
    categories["clinical"].save(update_fields=["is_active"])
    inactive = upload_document(api_client, doctor_user, patient, categories["clinical"])
    categories["clinical"].is_active = True
    categories["clinical"].save(update_fields=["is_active"])
    document = upload_document(api_client, doctor_user, patient, categories["clinical"])
    api_client.force_authenticate(user=None)
    unauthenticated = api_client.get(f"/api/v1/documents/{document.data['id']}/download/")

    assert inactive.status_code == status.HTTP_400_BAD_REQUEST
    assert unauthenticated.status_code == status.HTTP_401_UNAUTHORIZED
