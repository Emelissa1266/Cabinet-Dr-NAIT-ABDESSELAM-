from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.billing.models import BillableService, Invoice, InvoiceItem
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
    parameter = api_client.post(
        "/api/v1/care-parameter-definitions/",
        {
            "care_type": care_type.data["id"],
            "key": "wound_site",
            "label": "Wound site",
            "data_type": CareParameterDefinition.DataType.TEXT,
            "required": False,
            "active": True,
        },
        format="json",
    )
    assert parameter.status_code == status.HTTP_201_CREATED
    assert AuditLog.objects.filter(action="CARE_CATEGORY_CREATED", entity_id=str(category.data["id"])).exists()
    assert AuditLog.objects.filter(action="CARE_TYPE_CREATED", entity_id=str(care_type.data["id"])).exists()
    assert AuditLog.objects.filter(
        action="CARE_PARAMETER_DEFINITION_CREATED",
        entity_id=str(parameter.data["id"]),
    ).exists()

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
def test_nurse_creates_and_updates_care_without_doctor_assignment(api_client, secretary_user, nurse_user, patient, care_type):
    api_client.force_authenticate(user=nurse_user)

    created = api_client.post(
        "/api/v1/cares/",
        {
            "patient": patient.id,
            "care_type": care_type.id,
            "start_date": timezone.localdate().isoformat(),
            "planned_sessions": 3,
            "price_per_session": "1500.00",
            "notes": "Nursing care created independently",
        },
        format="json",
    )
    tampered = api_client.post(
        "/api/v1/cares/",
        {
            "patient": patient.id,
            "care_type": care_type.id,
            "assigned_nurse": secretary_user.id,
            "start_date": timezone.localdate().isoformat(),
            "planned_sessions": 1,
            "price_per_session": "1.00",
        },
        format="json",
    )
    updated = api_client.patch(
        f"/api/v1/cares/{created.data['id']}/",
        {"planned_sessions": 4, "price_per_session": "1750.00", "notes": "Updated by nurse"},
        format="json",
    )
    created_detail = api_client.get(f"/api/v1/cares/{created.data['id']}/")
    created_list = api_client.get("/api/v1/cares/")

    care = Care.objects.get(pk=created.data["id"])
    api_client.force_authenticate(user=secretary_user)
    secretary_read = api_client.get(f"/api/v1/cares/{care.id}/")

    assert created.status_code == status.HTTP_201_CREATED
    assert created.data["prescribed_by"] == nurse_user.id
    assert created.data["assigned_nurse"] == nurse_user.id
    assert created.data["total_price"] == "4500.00"
    assert tampered.status_code == status.HTTP_400_BAD_REQUEST
    assert updated.status_code == status.HTTP_200_OK
    assert updated.data["assigned_nurse"] == nurse_user.id
    assert updated.data["total_price"] == "7000.00"
    assert created_detail.status_code == status.HTTP_200_OK
    assert created_detail.data["id"] == created.data["id"]
    assert created_detail.data["remaining_sessions"] == 4
    assert created_list.status_code == status.HTTP_200_OK
    assert any(item["id"] == created.data["id"] for item in created_list.data["results"])
    assert secretary_read.status_code == status.HTTP_403_FORBIDDEN
    assert care.prescribed_by == nurse_user
    assert care.assigned_nurse == nurse_user
    assert AuditLog.objects.filter(action="CARE_CREATED", user=nurse_user).count() == 1
    assert AuditLog.objects.filter(action="CARE_UPDATED", user=nurse_user).count() == 1


@pytest.mark.django_db
def test_nurse_creates_care_session_with_authenticated_nurse(api_client, nurse_user, care_plan):
    api_client.force_authenticate(user=nurse_user)

    response = api_client.post(
        "/api/v1/care-sessions/",
        {
            "care": care_plan.id,
            "scheduled_at": timezone.now().isoformat(),
            "notes": "First planned execution",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["nurse"] == nurse_user.id
    assert response.data["status"] == CareSession.Status.PLANNED
    assert CareSession.objects.filter(care=care_plan, nurse=nurse_user).count() == 1

    tampered = api_client.post(
        "/api/v1/care-sessions/",
        {
            "care": care_plan.id,
            "scheduled_at": timezone.now().isoformat(),
            "status": CareSession.Status.COMPLETED,
            "unit_price": "1.00",
        },
        format="json",
    )
    assert tampered.status_code == status.HTTP_400_BAD_REQUEST
    assert CareSession.objects.filter(care=care_plan, nurse=nurse_user).count() == 1


@pytest.mark.django_db
def test_nurse_cannot_register_other_nurse_care(api_client, make_user, doctor_user, nurse_user, patient, care_type):
    other_nurse = make_user(role=User.Role.NURSE, username="assigned-other")
    other_assigned = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=other_nurse,
        start_date=timezone.localdate(),
        planned_sessions=1,
        price_per_session=Decimal("1500.00"),
    )
    api_client.force_authenticate(user=nurse_user)

    other_response = api_client.post(
        "/api/v1/care-sessions/",
        {"care": other_assigned.id, "scheduled_at": timezone.now().isoformat()},
        format="json",
    )

    assert other_response.status_code == status.HTTP_400_BAD_REQUEST
    assert CareSession.objects.count() == 0


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
def test_session_completion_does_not_create_invoice_and_nurse_explicitly_bills_care(
    api_client,
    admin_user,
    nurse_user,
    patient,
    care_type,
):
    care_plan = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=nurse_user,
        assigned_nurse=nurse_user,
        start_date=timezone.localdate(),
        planned_sessions=1,
        price_per_session=Decimal("2500.00"),
    )
    care_session = CareSession.objects.create(care=care_plan, nurse=nurse_user, scheduled_at=timezone.now())
    care_plan.planned_sessions = 1
    care_plan.price_per_session = Decimal("2500.00")
    care_plan.save(update_fields=["planned_sessions", "price_per_session"])

    api_client.force_authenticate(user=admin_user)
    admin_before = api_client.get("/api/v1/dashboard/").data

    api_client.force_authenticate(user=nurse_user)
    start = api_client.post(f"/api/v1/care-sessions/{care_session.id}/start/")
    complete = api_client.post(f"/api/v1/care-sessions/{care_session.id}/complete/")
    invoices_after_completion = Invoice.objects.count()
    invoice = api_client.post("/api/v1/invoices/", {"patient": patient.id, "notes": "Nursing invoice"}, format="json")
    item = api_client.post(
        "/api/v1/invoice-items/",
        {"invoice": invoice.data["id"], "care": care_plan.id},
        format="json",
    )
    issue = api_client.post(f"/api/v1/invoices/{invoice.data['id']}/issue/")
    forbidden_payment = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "2500.00", "payment_method": "CASH"},
        format="json",
    )

    invoice_item = InvoiceItem.objects.select_related("invoice").get(pk=item.data["id"])
    care_session.refresh_from_db()
    care_plan.refresh_from_db()
    api_client.force_authenticate(user=admin_user)
    admin_after = api_client.get("/api/v1/dashboard/").data
    admin_invoices = api_client.get("/api/v1/invoices/")

    assert start.status_code == status.HTTP_200_OK
    assert complete.status_code == status.HTTP_200_OK
    assert invoices_after_completion == 0
    assert invoice.status_code == status.HTTP_201_CREATED
    assert item.status_code == status.HTTP_201_CREATED
    assert issue.status_code == status.HTTP_200_OK
    assert forbidden_payment.status_code == status.HTTP_403_FORBIDDEN
    assert Invoice.objects.count() == 1
    assert InvoiceItem.objects.filter(care=care_plan).count() == 1
    assert invoice_item.quantity == Decimal("1.00")
    assert invoice_item.unit_price == Decimal("2500.00")
    assert invoice_item.net_amount == Decimal("2500.00")
    assert invoice_item.invoice.patient_id == care_plan.patient_id
    assert invoice_item.invoice.status == Invoice.Status.ISSUED
    assert invoice_item.invoice.invoice_number
    assert care_session.status == CareSession.Status.COMPLETED
    assert care_plan.status == Care.Status.COMPLETED
    assert admin_before["pending"]["care_workload_count"] == 1
    assert admin_after["pending"]["care_workload_count"] == 0
    assert admin_after["financial"]["outstanding_amount"] == "2500.00"
    assert any(item["id"] == invoice_item.invoice_id for item in admin_invoices.data["results"])
    assert AuditLog.objects.filter(action="INVOICE_CREATED", user=nurse_user).count() == 1
    assert AuditLog.objects.filter(action="INVOICE_ISSUED", user=nurse_user).count() == 1


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
def test_nurse_can_use_but_not_administer_care_and_billing_catalogs(api_client, nurse_user, care_type):
    BillableService.objects.create(
        code="nurse-config-denied",
        name="Denied service",
        category=BillableService.Category.CARE,
        default_unit_price=Decimal("1000.00"),
    )
    api_client.force_authenticate(user=nurse_user)

    care_type_response = api_client.get("/api/v1/care-types/")
    billable_service_response = api_client.get("/api/v1/billable-services/")
    care_type_write = api_client.post(
        "/api/v1/care-types/",
        {
            "category": care_type.category_id,
            "name": "Forbidden nurse type",
            "default_price": "1.00",
        },
        format="json",
    )
    billable_service_write = api_client.post(
        "/api/v1/billable-services/",
        {
            "code": "forbidden-nurse-service",
            "name": "Forbidden",
            "category": BillableService.Category.CARE,
            "default_unit_price": "1.00",
        },
        format="json",
    )

    assert care_type_response.status_code == status.HTTP_200_OK
    assert billable_service_response.status_code == status.HTTP_200_OK
    assert care_type_write.status_code == status.HTTP_403_FORBIDDEN
    assert billable_service_write.status_code == status.HTTP_403_FORBIDDEN


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
