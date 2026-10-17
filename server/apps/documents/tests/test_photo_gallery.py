# ruff: noqa: F811

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from PIL import Image

from apps.audit.models import AuditLog
from apps.documents.models import ClinicalPhoto, ClinicalPhotoComparison

from .test_documents_phase7 import (  # noqa: F401
    assign_nurse_care,
    image_file,
    other_patient,
    patient,
    private_storage,
    upload_photo,
)

pytestmark = pytest.mark.django_db


def create_set(api_client, doctor_user, patient, **data):
    api_client.force_authenticate(doctor_user)
    response = api_client.post("/api/v1/clinical-photo-sets/", {
        "patient": patient.pk, "title": "Suivi postopératoire", "anatomical_area": "Visage", **data,
    }, format="json")
    assert response.status_code == 201, response.data
    return response.data


def response_bytes(response):
    return b"".join(response.streaming_content)


def exif_image():
    buffer = BytesIO()
    exif = Image.Exif()
    exif[270] = "Confidential metadata"
    exif[274] = 6
    Image.new("RGB", (800, 600), (40, 90, 110)).save(buffer, "JPEG", exif=exif)
    return buffer.getvalue()


def test_upload_strips_metadata_and_corrects_orientation(api_client, doctor_user, patient):
    response = upload_photo(api_client, doctor_user, patient, image=SimpleUploadedFile("oriented.jpg", exif_image(), content_type="image/jpeg"))
    assert response.status_code == 201, response.data
    photo = ClinicalPhoto.objects.get(pk=response.data["id"])
    assert (photo.width, photo.height) == (600, 800)
    with photo.image.open("rb") as stored:
        image = Image.open(stored)
        assert not image.getexif()
        assert b"Confidential metadata" not in stored.read()


def test_legacy_original_preserved_and_all_image_responses_are_private(api_client, doctor_user, patient):
    response = upload_photo(api_client, doctor_user, patient)
    photo = ClinicalPhoto.objects.get(pk=response.data["id"])
    legacy = exif_image()
    # Simulate a pre-existing original; retrieval must never rewrite it.
    with photo.image.storage.open(photo.image.name, "wb") as stored:
        stored.write(legacy)
    for action in ["thumbnail", "view", "download"]:
        result = api_client.get(f"/api/v1/clinical-photos/{photo.pk}/{action}/")
        assert result.status_code == 200
        assert result["Cache-Control"] == "no-store, private"
        assert result["Pragma"] == "no-cache"
        assert result["Referrer-Policy"] == "no-referrer"
        assert result["X-Content-Type-Options"] == "nosniff"
        pixels = response_bytes(result)
        image = Image.open(BytesIO(pixels))
        assert not image.getexif()
        assert b"Confidential metadata" not in pixels
        if action == "thumbnail":
            assert max(image.size) <= 480
    with photo.image.open("rb") as stored:
        assert stored.read() == legacy
    assert AuditLog.objects.filter(action="CLINICAL_PHOTO_THUMBNAIL_VIEWED", entity_id=str(photo.pk)).exists()


def test_thumbnail_permissions_match_photos(api_client, doctor_user, nurse_user, secretary_user, admin_user, patient, other_patient):
    assign_nurse_care(patient, nurse_user)
    allowed = upload_photo(api_client, doctor_user, patient).data["id"]
    unrelated = upload_photo(api_client, doctor_user, other_patient).data["id"]
    api_client.force_authenticate(nurse_user)
    assert api_client.get(f"/api/v1/clinical-photos/{allowed}/thumbnail/").status_code == 200
    assert api_client.get(f"/api/v1/clinical-photos/{unrelated}/thumbnail/").status_code == 404
    assert api_client.get(f"/api/v1/clinical-photos/{unrelated}/view/").status_code == 404
    api_client.force_authenticate(secretary_user)
    assert api_client.get(f"/api/v1/clinical-photos/{allowed}/thumbnail/").status_code == 403
    api_client.force_authenticate(admin_user)
    assert api_client.get(f"/api/v1/clinical-photos/{allowed}/thumbnail/").status_code == 200
    api_client.force_authenticate(None)
    assert api_client.get(f"/api/v1/clinical-photos/{allowed}/thumbnail/").status_code in (401, 403)


def test_album_metadata_empty_series_and_no_n_plus_one(api_client, doctor_user, patient):
    populated = create_set(api_client, doctor_user, patient)
    empty = create_set(api_client, doctor_user, patient, title="Série vide")
    photo = upload_photo(api_client, doctor_user, patient, photo_set=populated["id"]).data
    for index in range(12):
        create_set(api_client, doctor_user, patient, title=f"Série {index}")
    with CaptureQueriesContext(connection) as queries:
        response = api_client.get("/api/v1/clinical-photo-sets/")
    assert response.status_code == 200, response.data
    assert len(queries) <= 4
    sets = {value["id"]: value for value in response.data["results"]}
    assert sets[populated["id"]]["photo_count"] == 1
    assert sets[populated["id"]]["cover_photo"] == photo["id"]
    assert sets[empty["id"]]["photo_count"] == 0
    assert sets[empty["id"]]["cover_photo"] is None
    assert response["Cache-Control"] == "no-store, private"
    assert sets[populated["id"]]["patient_name"] == "Docs Patient"


def test_search_filters_ordering_and_pagination(api_client, doctor_user, patient, other_patient):
    series = create_set(api_client, doctor_user, patient)
    for index in range(23):
        response = upload_photo(api_client, doctor_user, patient, photo_set=series["id"],
            description=f"Contrôle {index}", captured_at="2026-10-03T10:00:00Z", anatomical_area="Visage", photo_type="AFTER")
        assert response.status_code == 201, response.data
    upload_photo(api_client, doctor_user, other_patient)
    url = f"/api/v1/clinical-photos/?patient={patient.pk}&photo_set={series['id']}&photo_type=AFTER&captured_at__date=2026-10-03&search=postopératoire&ordering=photo_set__title,-captured_at"
    first = api_client.get(url)
    second = api_client.get(url + "&page=2")
    assert first.status_code == 200, first.data
    assert first.data["count"] == 23 and len(first.data["results"]) == 20
    assert len(second.data["results"]) == 3
    assert all(item["photo_set_title"] == "Suivi postopératoire" for item in first.data["results"])
    assert api_client.get("/api/v1/clinical-photos/?search=Docs&photo_type=AFTER").data["count"] == 23
    assert api_client.get("/api/v1/clinical-photos/?photo_type=BEFORE").data["count"] == 1
    assert api_client.get(url + "&anatomical_area=Abdomen").data["count"] == 0


def test_modify_archive_keep_file_and_protect_nonempty_series(api_client, doctor_user, patient, other_patient):
    series = create_set(api_client, doctor_user, patient)
    response = upload_photo(api_client, doctor_user, patient, photo_set=series["id"])
    photo = ClinicalPhoto.objects.get(pk=response.data["id"])
    with photo.image.open("rb") as stored:
        original = stored.read()
    updated = api_client.patch(f"/api/v1/clinical-photos/{photo.pk}/", {"description": "Légende modifiée", "notes": "Contrôle"}, format="json")
    assert updated.status_code == 200, updated.data
    assert AuditLog.objects.filter(action="CLINICAL_PHOTO_CHANGED", entity_id=str(photo.pk)).exists()
    assert api_client.patch(f"/api/v1/clinical-photo-sets/{series['id']}/", {"patient": other_patient.pk}, format="json").status_code == 400
    assert api_client.delete(f"/api/v1/clinical-photo-sets/{series['id']}/").status_code == 400
    assert api_client.delete(f"/api/v1/clinical-photos/{photo.pk}/").status_code == 405
    assert api_client.post(f"/api/v1/clinical-photos/{photo.pk}/archive/", {"reason": "Conservation"}, format="json").status_code == 200
    assert api_client.delete(f"/api/v1/clinical-photo-sets/{series['id']}/").status_code == 400
    assert api_client.patch(f"/api/v1/clinical-photos/{photo.pk}/?is_archived=true", {"description": "Blocked"}, format="json").status_code == 400
    album = api_client.get(f"/api/v1/clinical-photo-sets/{series['id']}/").data
    assert album["photo_count"] == 0 and album["cover_photo"] is None
    with photo.image.open("rb") as stored:
        assert stored.read() == original


def test_empty_series_update_delete_audited_and_nurse_scope(api_client, doctor_user, nurse_user, admin_user, patient, other_patient):
    assign_nurse_care(patient, nurse_user)
    series = create_set(api_client, doctor_user, patient)
    unrelated = create_set(api_client, doctor_user, other_patient)
    api_client.force_authenticate(nurse_user)
    visible = api_client.get("/api/v1/clinical-photo-sets/").data["results"]
    assert {item["id"] for item in visible} == {series["id"]}
    assert api_client.delete(f"/api/v1/clinical-photo-sets/{unrelated['id']}/").status_code == 404
    updated = api_client.patch(f"/api/v1/clinical-photo-sets/{series['id']}/", {"title": "Suivi infirmier"}, format="json")
    assert updated.status_code == 200, updated.data
    assert AuditLog.objects.filter(action="CLINICAL_PHOTO_SET_CHANGED").exists()
    assert api_client.delete(f"/api/v1/clinical-photo-sets/{series['id']}/").status_code == 204
    assert AuditLog.objects.filter(action="CLINICAL_PHOTO_SET_DELETED", entity_id=str(series["id"])).exists()
    api_client.force_authenticate(admin_user)
    assert api_client.delete(f"/api/v1/clinical-photo-sets/{unrelated['id']}/").status_code == 403


def test_failed_upload_does_not_create_record_or_remove_other_file(api_client, doctor_user, patient, other_patient, private_storage):
    series = create_set(api_client, doctor_user, patient)
    existing = upload_photo(api_client, doctor_user, patient).data["id"]
    files_before = set(private_storage.rglob("*.jpg"))
    response = upload_photo(api_client, doctor_user, other_patient, photo_set=series["id"])
    assert response.status_code == 400
    assert ClinicalPhoto.objects.count() == 1
    assert ClinicalPhoto.objects.get(pk=existing).image.storage.exists(ClinicalPhoto.objects.get(pk=existing).image.name)
    assert set(private_storage.rglob("*.jpg")) == files_before


def test_comparison_references_cannot_be_invalidated_by_edit(api_client, doctor_user, patient):
    before = upload_photo(api_client, doctor_user, patient).data["id"]
    after = upload_photo(api_client, doctor_user, patient, photo_type="AFTER").data["id"]
    comparison = ClinicalPhotoComparison.objects.create(patient=patient, before_photo_id=before, after_photo_id=after, created_by=doctor_user)
    response = api_client.patch(f"/api/v1/clinical-photos/{before}/", {"photo_type": "AFTER"}, format="json")
    assert response.status_code == 400, response.data
    assert ClinicalPhoto.objects.get(pk=before).photo_type == "BEFORE"
    assert ClinicalPhotoComparison.objects.filter(pk=comparison.pk).exists()


def test_cookie_csrf_guards_series_and_photo_changes(doctor_user, patient):
    from django.conf import settings
    from rest_framework.test import APIClient
    client = APIClient(enforce_csrf_checks=True)
    token = client.get("/api/v1/auth/csrf/").cookies[settings.CSRF_COOKIE_NAME].value
    login = client.post("/api/v1/auth/login/", {"username": doctor_user.username, "password": "safe-test-password"}, format="json", HTTP_X_CSRFTOKEN=token)
    assert login.status_code == 200
    payload = {"patient": patient.pk, "title": "CSRF", "anatomical_area": "Visage"}
    assert client.post("/api/v1/clinical-photo-sets/", payload, format="json").status_code == 403
    series = client.post("/api/v1/clinical-photo-sets/", payload, format="json", HTTP_X_CSRFTOKEN=token).data
    assert client.patch(f"/api/v1/clinical-photo-sets/{series['id']}/", {"title": "Blocked"}, format="json").status_code == 403
    assert client.delete(f"/api/v1/clinical-photo-sets/{series['id']}/").status_code == 403
    assert client.delete(f"/api/v1/clinical-photo-sets/{series['id']}/", HTTP_X_CSRFTOKEN=token).status_code == 204
    assert client.post("/api/v1/clinical-photos/", {"patient": patient.pk, "image": image_file(), "photo_type": "BEFORE", "anatomical_area": "Visage"}, format="multipart").status_code == 403
