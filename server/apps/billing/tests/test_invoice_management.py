from decimal import Decimal

import pytest

from apps.audit.models import AuditLog
from apps.billing.models import Invoice, InvoiceItem
from apps.patients.models import Patient
from apps.payments.models import Payment, PaymentAllocation, Receipt

pytestmark = pytest.mark.django_db


def payload(patient):
    return {"patient": patient.pk, "lines": [
        {"description": "Consultation", "quantity": "2.00", "unit_price": "1500.25"},
        {"description": "Contrôle", "quantity": "1.00", "unit_price": "500.00"}],
        "discount_amount": "100.00", "invoice_number": "INV-FAKE"}


def test_doctor_draft_edit_issue_summary_and_audit(api_client, doctor_user):
    api_client.force_authenticate(doctor_user)
    patient = Patient.objects.create(first_name="Invoice", last_name="Doctor")
    created = api_client.post("/api/v1/invoices/", payload(patient), format="json")
    assert created.status_code == 201, created.data
    assert created.data["invoice_number"] is None
    assert created.data["total"] == "3400.50"
    pk = created.data["id"]
    line = created.data["items"][0]
    edited = api_client.patch(f"/api/v1/invoices/{pk}/", {"notes": "Updated",
        "lines": [{"id": line["id"], "description": "Updated consultation", "quantity": "3.00", "unit_price": "1000.00"}]}, format="json")
    assert edited.status_code == 200, edited.data
    assert edited.data["total"] == "2900.00"
    assert len(edited.data["items"]) == 1
    issued = api_client.post(f"/api/v1/invoices/{pk}/issue/")
    assert issued.status_code == 200
    assert issued.data["invoice_number"].startswith("INV-")
    assert not issued.data["can_edit"] and not issued.data["can_delete"]
    assert api_client.patch(f"/api/v1/invoices/{pk}/", {"notes": "Forbidden"}, format="json").status_code == 400
    assert api_client.delete(f"/api/v1/invoices/{pk}/").status_code == 400
    summary = api_client.get(f"/api/v1/patients/{patient.pk}/financial-summary/")
    assert summary.data["total_invoiced"] == "2900.00"
    assert api_client.get("/api/v1/invoices/summary/").data == {"total": "2900.00", "paid": "0.00", "remaining": "2900.00"}
    assert AuditLog.objects.filter(action="INVOICE_CHANGED", entity_id=str(pk)).exists()


def test_atomic_create_edit_and_emit(api_client, doctor_user):
    api_client.force_authenticate(doctor_user)
    patient = Patient.objects.create(first_name="Atomic", last_name="Invoice")
    data = payload(patient)
    data["lines"][1]["quantity"] = "0.00"
    assert api_client.post("/api/v1/invoices/", data, format="json").status_code == 400
    assert not Invoice.objects.filter(patient=patient).exists()
    data = payload(patient)
    data["emit"] = True
    response = api_client.post("/api/v1/invoices/", data, format="json")
    assert response.status_code == 201, response.data
    assert response.data["status"] == "ISSUED"
    draft = api_client.post("/api/v1/invoices/", payload(patient), format="json").data
    failure = api_client.patch(f"/api/v1/invoices/{draft['id']}/", {"notes": "Should rollback", "lines": [{"id": response.data["items"][0]["id"], "description": "Wrong invoice"}]}, format="json")
    assert failure.status_code == 400
    assert Invoice.objects.get(pk=draft["id"]).notes == ""
    assert InvoiceItem.objects.filter(invoice_id=draft["id"]).count() == 2


def test_delete_draft_preserves_audit_and_updates_summary(api_client, doctor_user):
    api_client.force_authenticate(doctor_user)
    patient = Patient.objects.create(first_name="Delete", last_name="Draft")
    draft = api_client.post("/api/v1/invoices/", payload(patient), format="json").data
    pk = draft["id"]
    assert api_client.delete(f"/api/v1/invoices/{pk}/").status_code == 204
    assert not Invoice.objects.filter(pk=pk).exists()
    assert not InvoiceItem.objects.filter(invoice_id=pk).exists()
    assert AuditLog.objects.get(action="INVOICE_DELETED", entity_id=str(pk)).old_data["items"]
    assert api_client.get(f"/api/v1/patients/{patient.pk}/financial-summary/").data["total_invoiced"] == "0.00"


@pytest.mark.parametrize("completed", [False, True])
def test_allocations_payments_receipts_never_deleted(api_client, doctor_user, completed):
    api_client.force_authenticate(doctor_user)
    patient = Patient.objects.create(first_name="Protected", last_name="Financial")
    draft = api_client.post("/api/v1/invoices/", payload(patient), format="json").data
    invoice = Invoice.objects.get(pk=draft["id"])
    payment = Payment.objects.create(patient=patient, amount=Decimal("500.00"), payment_method="CASH",
                                     status="COMPLETED" if completed else "PENDING")
    allocation = PaymentAllocation.objects.create(payment=payment, invoice=invoice, amount=Decimal("500.00"))
    receipt = Receipt.objects.create(payment=payment, patient=patient) if completed else None
    if completed:
        invoice.status = "PAID"
        invoice.save()
    url = f"/api/v1/invoices/{invoice.pk}/"
    assert api_client.patch(url, {"notes": "Forbidden"}, format="json").status_code == 400
    assert api_client.delete(url).status_code == 400
    assert Invoice.objects.filter(pk=invoice.pk).exists()
    assert Payment.objects.filter(pk=payment.pk).exists()
    assert PaymentAllocation.objects.filter(pk=allocation.pk).exists()
    if receipt:
        assert Receipt.objects.filter(pk=receipt.pk).exists()


def test_nurse_own_draft_remains_independent(api_client, nurse_user, doctor_user):
    patient = Patient.objects.create(first_name="Nurse", last_name="Independent")
    api_client.force_authenticate(nurse_user)
    draft = api_client.post("/api/v1/invoices/", payload(patient), format="json")
    assert draft.status_code == 201, draft.data
    url = f"/api/v1/invoices/{draft.data['id']}/"
    assert api_client.patch(url, {"notes": "Nurse edit"}, format="json").status_code == 200
    assert api_client.delete(url).status_code == 204
    api_client.force_authenticate(doctor_user)
    other = api_client.post("/api/v1/invoices/", payload(patient), format="json").data
    api_client.force_authenticate(nurse_user)
    assert api_client.delete(f"/api/v1/invoices/{other['id']}/").status_code == 404


def test_anonymous_invoice_write_denied(api_client):
    assert api_client.post("/api/v1/invoices/", {}, format="json").status_code in (401, 403)


def test_summary_aggregates_all_pages_and_excludes_drafts(api_client, doctor_user):
    from apps.billing.services import create_invoice, create_invoice_item, issue_invoice
    patient = Patient.objects.create(first_name="All", last_name="Pages")
    for _ in range(25):
        invoice = create_invoice(patient=patient, actor=doctor_user)
        create_invoice_item(invoice=invoice, actor=doctor_user, description="Line", quantity=Decimal(1), unit_price=Decimal(100))
        issue_invoice(invoice=invoice, actor=doctor_user)
    create_invoice(patient=patient, actor=doctor_user)
    api_client.force_authenticate(doctor_user)
    assert len(api_client.get("/api/v1/invoices/").data["results"]) == 20
    summary = api_client.get("/api/v1/invoices/summary/")
    assert summary.status_code == 200, summary.data
    assert summary.data == {"total": "2500.00", "paid": "0.00", "remaining": "2500.00"}
    assert api_client.get("/api/v1/invoices/summary/?status=DRAFT").data["total"] == "0.00"


def test_cookie_jwt_csrf_protects_create_edit_and_delete(doctor_user):
    from django.conf import settings
    from rest_framework.test import APIClient
    client = APIClient(enforce_csrf_checks=True)
    csrf = client.get("/api/v1/auth/csrf/").cookies[settings.CSRF_COOKIE_NAME].value
    login = client.post("/api/v1/auth/login/", {"username": doctor_user.username, "password": "safe-test-password"}, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert login.status_code == 200
    patient = Patient.objects.create(first_name="CSRF", last_name="Invoice")
    assert client.post("/api/v1/invoices/", payload(patient), format="json").status_code == 403
    created = client.post("/api/v1/invoices/", payload(patient), format="json", HTTP_X_CSRFTOKEN=csrf)
    assert created.status_code == 201, created.data
    url = f"/api/v1/invoices/{created.data['id']}/"
    assert client.patch(url, {"notes": "Blocked"}, format="json").status_code == 403
    assert client.delete(url).status_code == 403
    assert client.patch(url, {"notes": "Allowed"}, format="json", HTTP_X_CSRFTOKEN=csrf).status_code == 200
    assert client.delete(url, HTTP_X_CSRFTOKEN=csrf).status_code == 204


def test_patient_change_preserves_clinical_source_integrity(api_client, doctor_user):
    from django.utils import timezone

    from apps.billing.services import create_invoice, create_invoice_item
    from apps.medical.models import Consultation
    patient = Patient.objects.create(first_name="Source", last_name="Original")
    other = Patient.objects.create(first_name="Other", last_name="Patient")
    consultation = Consultation.objects.create(patient=patient, doctor=doctor_user, consultation_date=timezone.now(), reason="Clinical source")
    invoice = create_invoice(patient=patient, actor=doctor_user)
    item = create_invoice_item(invoice=invoice, actor=doctor_user, consultation=consultation, description="Consultation", quantity=Decimal(1), unit_price=Decimal(1000))
    api_client.force_authenticate(doctor_user)
    response = api_client.patch(f"/api/v1/invoices/{invoice.pk}/", {"patient": other.pk, "notes": "Rollback"}, format="json")
    assert response.status_code == 400, response.data
    invoice.refresh_from_db()
    assert invoice.patient_id == patient.pk and invoice.notes == ""
    assert InvoiceItem.objects.get(pk=item.pk).consultation_id == consultation.pk


def test_nurse_summary_keeps_workspace_scope(api_client, nurse_user, doctor_user):
    from apps.billing.services import create_invoice, create_invoice_item, issue_invoice
    patient = Patient.objects.create(first_name="Scope", last_name="Invoice")
    for actor, amount in [(nurse_user, "500"), (doctor_user, "1000")]:
        invoice = create_invoice(patient=patient, actor=actor)
        create_invoice_item(invoice=invoice, actor=actor, description="Scope", quantity=Decimal(1), unit_price=Decimal(amount))
        issue_invoice(invoice=invoice, actor=actor)
    api_client.force_authenticate(nurse_user)
    response = api_client.get("/api/v1/invoices/summary/")
    assert response.status_code == 200, response.data
    assert response.data["total"] == "500.00"
