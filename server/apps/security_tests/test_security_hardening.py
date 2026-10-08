from decimal import Decimal
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework import status

from apps.accounts.models import User
from apps.billing.models import BillableService, Invoice
from apps.care.models import Care, CareCategory, CareType
from apps.documents.models import ClinicalPhoto, ClinicalPhotoSet, DocumentCategory
from apps.patients.models import Patient

pytestmark = pytest.mark.django_db


def make_patient(first_name="Security", last_name="Patient"):
    return Patient.objects.create(first_name=first_name, last_name=last_name)


def make_care(patient, nurse):
    category = CareCategory.objects.create(name=f"Security care {patient.id}")
    care_type = CareType.objects.create(category=category, name="Wound dressing")
    return Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=nurse,
        assigned_nurse=nurse,
        start_date=timezone.localdate(),
        planned_sessions=1,
        price_per_session=Decimal("1000.00"),
    )


def image_file(name="security.jpg"):
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color=(50, 90, 130)).save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


def upload_photo(api_client, user, patient, **overrides):
    api_client.force_authenticate(user=user)
    payload = {
        "patient": patient.id,
        "photo_type": ClinicalPhoto.PhotoType.BEFORE,
        "anatomical_area": "FACE",
        "view_angle": ClinicalPhoto.ViewAngle.FRONT,
        "image": image_file(),
    }
    payload.update(overrides)
    return api_client.post("/api/v1/clinical-photos/", payload, format="multipart")


def test_anonymous_requests_cannot_access_patient_or_financial_data(api_client):
    assert api_client.get("/api/v1/patients/").status_code == status.HTTP_401_UNAUTHORIZED
    assert api_client.get("/api/v1/invoices/").status_code == status.HTTP_401_UNAUTHORIZED
    assert api_client.get("/api/v1/documents/").status_code == status.HTTP_401_UNAUTHORIZED


def test_non_admin_cannot_manage_users(api_client, nurse_user):
    api_client.force_authenticate(user=nurse_user)
    response = api_client.post(
        "/api/v1/auth/users/",
        {
            "username": "promoted",
            "email": "promoted@example.com",
            "password": "safe-test-password",
            "role": User.Role.ADMIN,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_nurse_clinical_photo_bola_is_care_scoped(api_client, doctor_user, nurse_user):
    patient = make_patient()
    unrelated_patient = make_patient("Unrelated", "Patient")
    make_care(patient, nurse_user)
    allowed_set = ClinicalPhotoSet.objects.create(
        patient=patient,
        title="Allowed care photos",
        anatomical_area="FACE",
        created_by=doctor_user,
    )
    unrelated_set = ClinicalPhotoSet.objects.create(
        patient=unrelated_patient,
        title="Unrelated photos",
        anatomical_area="FACE",
        created_by=doctor_user,
    )
    allowed_photo = upload_photo(api_client, doctor_user, patient, photo_set=allowed_set.id)
    unrelated_photo = upload_photo(api_client, doctor_user, unrelated_patient, photo_set=unrelated_set.id)

    api_client.force_authenticate(user=nurse_user)
    photo_list = api_client.get("/api/v1/clinical-photos/")
    allowed_view = api_client.get(f"/api/v1/clinical-photos/{allowed_photo.data['id']}/view/")
    unrelated_view = api_client.get(f"/api/v1/clinical-photos/{unrelated_photo.data['id']}/view/")
    unrelated_create = upload_photo(api_client, nurse_user, unrelated_patient)

    assert photo_list.status_code == status.HTTP_200_OK
    assert {item["id"] for item in photo_list.data["results"]} == {allowed_photo.data["id"]}
    assert allowed_view.status_code == status.HTTP_200_OK
    assert allowed_view["Cache-Control"] == "no-store, private"
    assert unrelated_view.status_code == status.HTTP_404_NOT_FOUND
    assert unrelated_create.status_code == status.HTTP_400_BAD_REQUEST


def test_invoice_items_reject_cross_patient_and_cross_nurse_sources(api_client, secretary_user, nurse_user, make_user):
    patient = make_patient()
    unrelated_patient = make_patient("Other", "Billing")
    other_nurse = make_user(role=User.Role.NURSE, username="security-other-nurse")
    care = make_care(patient, nurse_user)
    unrelated_care = make_care(unrelated_patient, other_nurse)
    service = BillableService.objects.create(
        code="security-service",
        name="Security service",
        category=BillableService.Category.CARE,
        default_unit_price=Decimal("500.00"),
    )

    api_client.force_authenticate(user=secretary_user)
    invoice = api_client.post("/api/v1/invoices/", {"patient": patient.id}, format="json")
    cross_patient = api_client.post(
        "/api/v1/invoice-items/",
        {"invoice": invoice.data["id"], "care": unrelated_care.id},
        format="json",
    )

    api_client.force_authenticate(user=nurse_user)
    nurse_invoice = api_client.post("/api/v1/invoices/", {"patient": patient.id}, format="json")
    nurse_allowed = api_client.post(
        "/api/v1/invoice-items/",
        {"invoice": nurse_invoice.data["id"], "care": care.id},
        format="json",
    )
    nurse_cross_care = api_client.post(
        "/api/v1/invoice-items/",
        {"invoice": nurse_invoice.data["id"], "care": unrelated_care.id, "billable_service": service.id},
        format="json",
    )

    assert cross_patient.status_code == status.HTTP_400_BAD_REQUEST
    assert nurse_allowed.status_code == status.HTTP_201_CREATED
    assert nurse_cross_care.status_code == status.HTTP_400_BAD_REQUEST
    assert Invoice.objects.get(pk=nurse_invoice.data["id"]).created_by == nurse_user


def test_secretary_cannot_upload_clinical_documents(api_client, secretary_user):
    patient = make_patient()
    category = DocumentCategory.objects.create(
        code="security-clinical",
        name="Security clinical",
        system_type=DocumentCategory.SystemType.CLINICAL,
    )
    api_client.force_authenticate(user=secretary_user)
    response = api_client.post(
        "/api/v1/documents/",
        {
            "patient": patient.id,
            "category": category.id,
            "title": "Clinical document",
            "file": SimpleUploadedFile("report.pdf", b"%PDF-1.4\nsecurity\n%%EOF", content_type="application/pdf"),
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
