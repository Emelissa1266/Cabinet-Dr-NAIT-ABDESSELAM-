from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status

from apps.audit.models import AuditLog
from apps.billing.models import BillableService, Invoice, InvoiceItem
from apps.care.models import Care, CareCategory, CareSession, CareType
from apps.medical.models import Consultation
from apps.patients.models import Patient
from apps.payments.models import Payment, PaymentAllocation, Receipt
from apps.surgery.models import Surgery


@pytest.fixture
def patient(db, secretary_user):
    return Patient.objects.create(first_name="Billing", last_name="Patient", created_by=secretary_user)


@pytest.fixture
def other_patient(db):
    return Patient.objects.create(first_name="Other", last_name="Patient")


@pytest.fixture
def service(db):
    return BillableService.objects.create(
        code="consultation-initial",
        name="Initial consultation",
        category=BillableService.Category.CONSULTATION,
        default_unit_price=Decimal("5000.00"),
    )


def create_draft_invoice(api_client, secretary_user, patient, discount="0.00"):
    api_client.force_authenticate(user=secretary_user)
    response = api_client.post(
        "/api/v1/invoices/",
        {"patient": patient.id, "discount_amount": discount, "total": "1.00", "paid_amount": "1.00"},
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    return response.data["id"]


def add_item(api_client, invoice_id, service_id, **overrides):
    payload = {"invoice": invoice_id, "billable_service": service_id}
    payload.update(overrides)
    response = api_client.post("/api/v1/invoice-items/", payload, format="json")
    assert response.status_code == status.HTTP_201_CREATED, response.data
    return response


def issue_invoice(api_client, invoice_id):
    response = api_client.post(f"/api/v1/invoices/{invoice_id}/issue/")
    assert response.status_code == status.HTTP_200_OK, response.data
    return response


@pytest.mark.django_db
def test_catalog_admin_only_and_snapshot_pricing(api_client, admin_user, secretary_user, patient, service):
    api_client.force_authenticate(user=secretary_user)
    forbidden = api_client.post(
        "/api/v1/billable-services/",
        {"code": "secretary-service", "name": "Secretary service", "default_unit_price": "100.00"},
        format="json",
    )
    api_client.force_authenticate(user=admin_user)
    created = api_client.post(
        "/api/v1/billable-services/",
        {"code": "admin-service", "name": "Admin service", "default_unit_price": "1000.00"},
        format="json",
    )
    assert forbidden.status_code == status.HTTP_403_FORBIDDEN
    assert created.status_code == status.HTTP_201_CREATED

    invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    item = add_item(api_client, invoice_id, service.id)
    service.default_unit_price = Decimal("6000.00")
    service.save(update_fields=["default_unit_price"])
    invoice = api_client.get(f"/api/v1/invoices/{invoice_id}/")

    assert item.data["unit_price"] == "5000.00"
    assert invoice.data["items"][0]["unit_price"] == "5000.00"
    assert AuditLog.objects.filter(action="BILLABLE_SERVICE_CREATED").exists()


@pytest.mark.django_db
def test_invoice_item_decimal_calculation_and_validation(api_client, secretary_user, patient, service):
    invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    response = add_item(
        api_client,
        invoice_id,
        service.id,
        quantity="3.00",
        unit_price="1000.50",
        discount_amount="1.50",
    )
    invalid = api_client.post(
        "/api/v1/invoice-items/",
        {
            "invoice": invoice_id,
            "billable_service": service.id,
            "quantity": "1.00",
            "unit_price": "10.00",
            "discount_amount": "11.00",
        },
        format="json",
    )
    invoice = api_client.get(f"/api/v1/invoices/{invoice_id}/")

    assert response.data["gross_amount"] == "3001.50"
    assert response.data["net_amount"] == "3000.00"
    assert invalid.status_code == status.HTTP_400_BAD_REQUEST
    assert InvoiceItem.objects.count() == 1
    assert invoice.data["subtotal"] == "3000.00"
    assert invoice.data["total"] == "3000.00"
    assert invoice.data["paid_amount"] == "0.00"
    assert invoice.data["remaining_amount"] == "3000.00"


@pytest.mark.django_db
def test_invoice_lifecycle_and_immutability(api_client, secretary_user, patient, service):
    invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    empty_issue = api_client.post(f"/api/v1/invoices/{invoice_id}/issue/")
    add_item(api_client, invoice_id, service.id, unit_price="50000.00")
    issued = issue_invoice(api_client, invoice_id)
    invoice = Invoice.objects.get(pk=invoice_id)
    item = invoice.items.get()

    rewrite = api_client.patch(
        f"/api/v1/invoice-items/{item.id}/",
        {"unit_price": "1.00"},
        format="json",
    )
    delete = api_client.delete(f"/api/v1/invoices/{invoice_id}/")
    repeat_issue = api_client.post(f"/api/v1/invoices/{invoice_id}/issue/")

    assert empty_issue.status_code == status.HTTP_400_BAD_REQUEST
    assert issued.data["status"] == Invoice.Status.ISSUED
    assert issued.data["invoice_number"].startswith(f"INV-{timezone.localdate().year}-")
    assert rewrite.status_code == status.HTTP_400_BAD_REQUEST
    assert delete.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    assert repeat_issue.status_code == status.HTTP_400_BAD_REQUEST
    item.refresh_from_db()
    assert item.unit_price == Decimal("50000.00")


@pytest.mark.django_db
def test_unpaid_invoice_can_cancel_but_paid_invoice_cannot(api_client, secretary_user, patient, service):
    invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, invoice_id, service.id, unit_price="20000.00")
    issue_invoice(api_client, invoice_id)
    cancelled = api_client.post(f"/api/v1/invoices/{invoice_id}/cancel/", {"reason": "Patient cancelled"}, format="json")

    paid_invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, paid_invoice_id, service.id, unit_price="10000.00")
    issue_invoice(api_client, paid_invoice_id)
    payment = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "10000.00", "payment_method": Payment.Method.CASH},
        format="json",
    )
    api_client.post(f"/api/v1/payments/{payment.data['id']}/allocate/", {"invoice": paid_invoice_id, "amount": "10000.00"}, format="json")
    api_client.post(f"/api/v1/payments/{payment.data['id']}/complete/")
    paid_cancel = api_client.post(
        f"/api/v1/invoices/{paid_invoice_id}/cancel/",
        {"reason": "Should fail"},
        format="json",
    )
    paid_invoice = Invoice.objects.get(pk=paid_invoice_id)

    assert cancelled.data["status"] == Invoice.Status.CANCELLED
    assert paid_cancel.status_code == status.HTTP_400_BAD_REQUEST
    assert paid_invoice.status == Invoice.Status.PAID


@pytest.mark.django_db
def test_clinical_source_consistency_care_pricing_and_duplicate_protection(
    api_client,
    secretary_user,
    doctor_user,
    nurse_user,
    patient,
    other_patient,
    service,
):
    consultation = Consultation.objects.create(patient=patient, doctor=doctor_user, consultation_date=timezone.now(), reason="Visit")
    wrong_surgery = Surgery.objects.create(patient=other_patient, surgeon=doctor_user, procedure_name="Wrong", indication="Mismatch")
    category = CareCategory.objects.create(name="Dressings")
    care_type = CareType.objects.create(category=category, name="Dressing")
    care = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=nurse_user,
        start_date=timezone.localdate(),
        planned_sessions=4,
        price_per_session=Decimal("2500.00"),
    )
    care_session = CareSession.objects.create(care=care, nurse=nurse_user)
    invoice_id = create_draft_invoice(api_client, secretary_user, patient)

    consultation_item = add_item(api_client, invoice_id, service.id, consultation=consultation.id)
    care_item = api_client.post("/api/v1/invoice-items/", {"invoice": invoice_id, "care": care.id}, format="json")
    duplicate_care_session = api_client.post(
        "/api/v1/invoice-items/",
        {"invoice": invoice_id, "care_session": care_session.id},
        format="json",
    )
    mismatch = api_client.post(
        "/api/v1/invoice-items/",
        {"invoice": invoice_id, "billable_service": service.id, "surgery": wrong_surgery.id},
        format="json",
    )

    assert consultation_item.status_code == status.HTTP_201_CREATED
    assert care_item.status_code == status.HTTP_201_CREATED
    assert care_item.data["quantity"] == "4.00"
    assert care_item.data["unit_price"] == "2500.00"
    assert care_item.data["net_amount"] == "10000.00"
    assert duplicate_care_session.status_code == status.HTTP_400_BAD_REQUEST
    assert mismatch.status_code == status.HTTP_400_BAD_REQUEST
    assert InvoiceItem.objects.count() == 2


@pytest.mark.django_db
def test_partial_payments_overpayment_protection_and_receipt_data(api_client, secretary_user, patient, service):
    invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, invoice_id, service.id, unit_price="100000.00")
    issue_invoice(api_client, invoice_id)

    first = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "30000.00", "payment_method": Payment.Method.CASH},
        format="json",
    )
    api_client.post(f"/api/v1/payments/{first.data['id']}/allocate/", {"invoice": invoice_id, "amount": "30000.00"}, format="json")
    completed_first = api_client.post(f"/api/v1/payments/{first.data['id']}/complete/")
    invoice = Invoice.objects.get(pk=invoice_id)
    assert completed_first.data["status"] == Payment.Status.COMPLETED
    assert invoice.paid_amount == Decimal("30000.00")
    assert invoice.remaining_amount == Decimal("70000.00")
    assert invoice.status == Invoice.Status.PARTIALLY_PAID

    second = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "70000.00", "payment_method": Payment.Method.CARD},
        format="json",
    )
    overpay = api_client.post(
        f"/api/v1/payments/{second.data['id']}/allocate/",
        {"invoice": invoice_id, "amount": "70001.00"},
        format="json",
    )
    api_client.post(f"/api/v1/payments/{second.data['id']}/allocate/", {"invoice": invoice_id, "amount": "70000.00"}, format="json")
    api_client.post(f"/api/v1/payments/{second.data['id']}/complete/")
    invoice.refresh_from_db()
    receipt = api_client.get(f"/api/v1/receipts/{Receipt.objects.get(payment_id=first.data['id']).id}/")

    assert overpay.status_code == status.HTTP_400_BAD_REQUEST
    assert invoice.paid_amount == Decimal("100000.00")
    assert invoice.remaining_amount == Decimal("0.00")
    assert invoice.status == Invoice.Status.PAID
    assert receipt.data["payment_number"].startswith(f"PAY-{timezone.localdate().year}-")
    assert receipt.data["receipt_number"].startswith(f"REC-{timezone.localdate().year}-")
    assert receipt.data["allocations"][0]["amount"] == Decimal("30000.00")


@pytest.mark.django_db
def test_payment_cancellation_preserves_history_and_recalculates_invoice(api_client, secretary_user, patient, service):
    invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, invoice_id, service.id, unit_price="50000.00")
    issue_invoice(api_client, invoice_id)
    payment = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "20000.00", "payment_method": Payment.Method.CASH},
        format="json",
    )
    api_client.post(f"/api/v1/payments/{payment.data['id']}/allocate/", {"invoice": invoice_id, "amount": "20000.00"}, format="json")
    api_client.post(f"/api/v1/payments/{payment.data['id']}/complete/")
    cancelled = api_client.post(
        f"/api/v1/payments/{payment.data['id']}/cancel/",
        {"reason": "Entry error"},
        format="json",
    )
    invoice = Invoice.objects.get(pk=invoice_id)

    assert cancelled.data["status"] == Payment.Status.CANCELLED
    assert invoice.paid_amount == Decimal("0.00")
    assert invoice.remaining_amount == Decimal("50000.00")
    assert invoice.status == Invoice.Status.ISSUED
    assert PaymentAllocation.objects.count() == 1
    assert Receipt.objects.count() == 1


@pytest.mark.django_db
def test_receipt_requires_completed_payment(api_client, secretary_user, patient):
    api_client.force_authenticate(user=secretary_user)
    payment = Payment.objects.create(
        patient=patient,
        amount=Decimal("1000.00"),
        payment_method=Payment.Method.CASH,
        received_by=secretary_user,
    )
    receipt = Receipt(payment=payment, patient=patient, issued_by=secretary_user)

    with pytest.raises(ValidationError):
        receipt.full_clean()
    assert api_client.post("/api/v1/receipts/", {}, format="json").status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
def test_patient_financial_summary_excludes_cancelled_invoices(api_client, secretary_user, patient, service):
    paid_invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, paid_invoice_id, service.id, unit_price="10000.00")
    issue_invoice(api_client, paid_invoice_id)
    payment = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "10000.00", "payment_method": Payment.Method.CASH},
        format="json",
    )
    api_client.post(f"/api/v1/payments/{payment.data['id']}/allocate/", {"invoice": paid_invoice_id, "amount": "10000.00"}, format="json")
    api_client.post(f"/api/v1/payments/{payment.data['id']}/complete/")

    partial_invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, partial_invoice_id, service.id, unit_price="20000.00")
    issue_invoice(api_client, partial_invoice_id)
    partial_payment = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "5000.00", "payment_method": Payment.Method.CASH},
        format="json",
    )
    api_client.post(f"/api/v1/payments/{partial_payment.data['id']}/allocate/", {"invoice": partial_invoice_id, "amount": "5000.00"}, format="json")
    api_client.post(f"/api/v1/payments/{partial_payment.data['id']}/complete/")

    unpaid_invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, unpaid_invoice_id, service.id, unit_price="30000.00")
    issue_invoice(api_client, unpaid_invoice_id)
    cancelled_invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, cancelled_invoice_id, service.id, unit_price="40000.00")
    api_client.post(f"/api/v1/invoices/{cancelled_invoice_id}/cancel/", {"reason": "Cancelled"}, format="json")

    summary = api_client.get(f"/api/v1/patients/{patient.id}/financial-summary/")
    assert summary.data == {
        "patient": patient.id,
        "total_invoiced": "60000.00",
        "total_paid": "15000.00",
        "total_remaining": "45000.00",
        "unpaid_invoices_count": 1,
        "partially_paid_invoices_count": 1,
    }


@pytest.mark.django_db
def test_financial_rbac_and_nurse_care_visibility(
    api_client,
    admin_user,
    doctor_user,
    nurse_user,
    secretary_user,
    patient,
    other_patient,
    service,
):
    category = CareCategory.objects.create(name="Nurse care")
    care_type = CareType.objects.create(category=category, name="Care")
    care = Care.objects.create(
        patient=patient,
        care_type=care_type,
        prescribed_by=doctor_user,
        assigned_nurse=nurse_user,
        start_date=timezone.localdate(),
        planned_sessions=1,
        price_per_session=Decimal("1000.00"),
    )
    care_invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    api_client.post("/api/v1/invoice-items/", {"invoice": care_invoice_id, "care": care.id}, format="json")
    issue_invoice(api_client, care_invoice_id)

    unrelated_invoice_id = create_draft_invoice(api_client, secretary_user, other_patient)
    add_item(api_client, unrelated_invoice_id, service.id, unit_price="1000.00")
    issue_invoice(api_client, unrelated_invoice_id)

    api_client.force_authenticate(user=doctor_user)
    doctor_read = api_client.get(f"/api/v1/invoices/{care_invoice_id}/")
    doctor_mutation = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "1000.00", "payment_method": Payment.Method.CASH},
        format="json",
    )
    api_client.force_authenticate(user=nurse_user)
    nurse_list = api_client.get("/api/v1/invoices/")
    nurse_mutation = api_client.patch(f"/api/v1/invoices/{care_invoice_id}/", {"notes": "Nope"}, format="json")
    nurse_invoice = api_client.post("/api/v1/invoices/", {"patient": patient.id, "notes": "Nurse draft"}, format="json")
    nurse_invoice_update = api_client.patch(
        f"/api/v1/invoices/{nurse_invoice.data['id']}/",
        {"notes": "Nurse updated draft"},
        format="json",
    )
    nurse_payment = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "1000.00", "payment_method": Payment.Method.CASH},
        format="json",
    )
    api_client.force_authenticate(user=admin_user)
    admin_read = api_client.get("/api/v1/invoices/")

    assert doctor_read.status_code == status.HTTP_200_OK
    assert doctor_mutation.status_code == status.HTTP_403_FORBIDDEN
    assert nurse_list.status_code == status.HTTP_200_OK
    assert [item["id"] for item in nurse_list.data["results"]] == [care_invoice_id]
    assert nurse_mutation.status_code == status.HTTP_400_BAD_REQUEST
    assert nurse_invoice.status_code == status.HTTP_201_CREATED
    assert nurse_invoice_update.status_code == status.HTTP_200_OK
    assert nurse_payment.status_code == status.HTTP_403_FORBIDDEN
    assert admin_read.data["count"] == 3
    assert Invoice.objects.get(pk=care_invoice_id).notes == ""
    assert Invoice.objects.get(pk=nurse_invoice.data["id"]).notes == "Nurse updated draft"


@pytest.mark.django_db
def test_financial_audit_events(api_client, secretary_user, patient, service):
    invoice_id = create_draft_invoice(api_client, secretary_user, patient)
    add_item(api_client, invoice_id, service.id, unit_price="1000.00")
    api_client.patch(f"/api/v1/invoices/{invoice_id}/", {"discount_amount": "100.00"}, format="json")
    issue_invoice(api_client, invoice_id)
    payment = api_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": "900.00", "payment_method": Payment.Method.CASH},
        format="json",
    )
    api_client.post(f"/api/v1/payments/{payment.data['id']}/allocate/", {"invoice": invoice_id, "amount": "900.00"}, format="json")
    api_client.post(f"/api/v1/payments/{payment.data['id']}/complete/")
    api_client.post(f"/api/v1/payments/{payment.data['id']}/cancel/", {"reason": "Correction"}, format="json")

    expected = {
        "INVOICE_CREATED",
        "INVOICE_ITEM_ADDED",
        "INVOICE_DISCOUNT_CHANGED",
        "INVOICE_ISSUED",
        "PAYMENT_CREATED",
        "PAYMENT_ALLOCATED",
        "PAYMENT_COMPLETED",
        "PAYMENT_CANCELLED",
        "RECEIPT_CREATED",
    }
    assert expected.issubset(set(AuditLog.objects.values_list("action", flat=True)))
