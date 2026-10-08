import re
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status

from apps.audit.models import AuditLog
from apps.billing.models import BillableService, Invoice, InvoiceItem
from apps.payments.models import Payment, PaymentAllocation


@pytest.fixture
def pdf_patient(db, secretary_user):
    from apps.patients.models import Patient

    return Patient.objects.create(first_name="Nadia", last_name="Belaid", created_by=secretary_user)


@pytest.fixture
def issued_invoice(db, secretary_user, pdf_patient):
    service = BillableService.objects.create(
        code="pdf-consultation",
        name="Consultation esthétique",
        default_unit_price=Decimal("20997.00"),
    )
    invoice = Invoice.objects.create(
        patient=pdf_patient,
        status=Invoice.Status.DRAFT,
        issue_date=timezone.localdate(),
        due_date=timezone.localdate(),
        created_by=secretary_user,
    )
    InvoiceItem.objects.create(
        invoice=invoice,
        billable_service=service,
        description="Consultation esthétique",
        quantity=Decimal("1.00"),
        unit_price=Decimal("20997.00"),
        discount_amount=Decimal("0.00"),
    )
    invoice.invoice_number = "INV-2026-000004"
    invoice.status = Invoice.Status.ISSUED
    invoice.finalized_by = secretary_user
    invoice.finalized_at = timezone.now()
    invoice.save(update_fields=["invoice_number", "status", "finalized_by", "finalized_at", "updated_at"])
    return invoice


@pytest.mark.django_db
def test_authorized_invoice_pdf_uses_backend_invoice_data(api_client, secretary_user, issued_invoice):
    api_client.force_authenticate(user=secretary_user)

    response = api_client.get(f"/api/v1/invoices/{issued_invoice.id}/pdf/")
    body = bytes(response.content)

    assert response.status_code == status.HTTP_200_OK
    assert response["Content-Type"] == "application/pdf"
    assert response["Content-Disposition"] == 'attachment; filename="INV-2026-000004.pdf"'
    assert body.startswith(b"%PDF-1.4")
    text = body.decode("cp1252", errors="ignore")
    assert "/DCTDecode" in text
    assert "INV-2026-000004" in text
    assert "20 997,00 DZD" in text
    assert "Nadia Belaid" in text
    assert "Consultation esthétique" in text
    assert AuditLog.objects.filter(action="INVOICE_PDF_DOWNLOADED", entity_id=str(issued_invoice.id)).exists()


@pytest.mark.django_db
def test_invoice_print_uses_same_pdf_document_and_audits(api_client, secretary_user, issued_invoice):
    api_client.force_authenticate(user=secretary_user)

    download = api_client.get(f"/api/v1/invoices/{issued_invoice.id}/pdf/")
    printable = api_client.get(f"/api/v1/invoices/{issued_invoice.id}/print/")

    assert printable.status_code == status.HTTP_200_OK
    assert printable["Content-Type"] == "application/pdf"
    assert printable["Content-Disposition"] == 'inline; filename="INV-2026-000004.pdf"'
    assert bytes(printable.content) == bytes(download.content)
    assert AuditLog.objects.filter(action="INVOICE_PRINT_VIEWED", entity_id=str(issued_invoice.id)).exists()


@pytest.mark.django_db
def test_invoice_pdf_requires_authentication(api_client, issued_invoice):
    response = api_client.get(f"/api/v1/invoices/{issued_invoice.id}/pdf/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_invoice_pdf_respects_restricted_invoice_queryset(api_client, nurse_user, issued_invoice):
    api_client.force_authenticate(user=nurse_user)

    response = api_client.get(f"/api/v1/invoices/{issued_invoice.id}/pdf/")

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_invoice_pdf_handles_discount_payment_long_description_and_multipage(
    api_client,
    secretary_user,
    pdf_patient,
):
    api_client.force_authenticate(user=secretary_user)
    service = BillableService.objects.create(
        code="pdf-long-service",
        name="Protocole post-opératoire détaillé",
        default_unit_price=Decimal("1200.00"),
    )
    invoice = Invoice.objects.create(
        patient=pdf_patient,
        status=Invoice.Status.DRAFT,
        issue_date=timezone.localdate(),
        due_date=timezone.localdate(),
        discount_amount=Decimal("500.00"),
        created_by=secretary_user,
    )
    long_description = (
        "Protocole post-opératoire détaillé avec surveillance clinique, soins locaux, "
        "contrôle cicatriciel et recommandations personnalisées"
    )
    for index in range(22):
        InvoiceItem.objects.create(
            invoice=invoice,
            billable_service=service,
            description=f"{long_description} #{index + 1}",
            quantity=Decimal("1.00"),
            unit_price=Decimal("1200.00"),
            discount_amount=Decimal("50.00") if index == 0 else Decimal("0.00"),
        )
    invoice.invoice_number = "INV-2026-000099"
    invoice.status = Invoice.Status.PARTIALLY_PAID
    invoice.finalized_by = secretary_user
    invoice.finalized_at = timezone.now()
    invoice.save(update_fields=["invoice_number", "status", "finalized_by", "finalized_at", "updated_at"])
    payment = Payment.objects.create(
        patient=pdf_patient,
        amount=Decimal("2500.00"),
        payment_method=Payment.Method.CASH,
        status=Payment.Status.COMPLETED,
        payment_number="PAY-2026-000099",
        received_by=secretary_user,
    )
    PaymentAllocation.objects.create(payment=payment, invoice=invoice, amount=Decimal("2500.00"))

    response = api_client.get(f"/api/v1/invoices/{invoice.id}/pdf/")
    text = bytes(response.content).decode("cp1252", errors="ignore")

    assert response.status_code == status.HTTP_200_OK
    assert re.search(r"/Count [2-9]", text)
    assert "Partiellement payée" in text
    assert "Protocole post-opératoire détaillé" in text
    assert "Remise" in text
    assert "PAY-2026-000099" in text
    assert "SOLDE À PAYER" in text
