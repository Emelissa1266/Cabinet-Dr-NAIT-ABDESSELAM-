from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.audit.services import record_audit_event

from .models import MONEY_ZERO, BillableService, FinancialSequence, Invoice, InvoiceItem


def next_financial_number(*, key: str, prefix: str) -> str:
    year = timezone.localdate().year
    with transaction.atomic():
        sequence, _ = FinancialSequence.objects.select_for_update().get_or_create(
            key=key,
            year=year,
            defaults={"current_value": 0},
        )
        sequence.current_value += 1
        sequence.save(update_fields=["current_value"])
    return f"{prefix}-{year}-{sequence.current_value:06d}"


def invoice_paid_amount(invoice: Invoice) -> Decimal:
    from apps.payments.models import Payment

    aggregate = invoice.allocations.filter(payment__status=Payment.Status.COMPLETED).aggregate(total=Sum("amount"))
    return aggregate["total"] or MONEY_ZERO


def invoice_reserved_allocation_amount(invoice: Invoice) -> Decimal:
    from apps.payments.models import Payment

    aggregate = invoice.allocations.exclude(payment__status=Payment.Status.CANCELLED).aggregate(total=Sum("amount"))
    return aggregate["total"] or MONEY_ZERO


def invoice_allocatable_amount(invoice: Invoice) -> Decimal:
    return max(invoice.total - invoice_reserved_allocation_amount(invoice), MONEY_ZERO)


def recalculate_invoice_status(invoice: Invoice) -> Invoice:
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status in {Invoice.Status.DRAFT, Invoice.Status.CANCELLED}:
        return invoice
    total = invoice.total
    paid = invoice_paid_amount(invoice)
    if total <= MONEY_ZERO or paid >= total:
        invoice.status = Invoice.Status.PAID
    elif paid > MONEY_ZERO:
        invoice.status = Invoice.Status.PARTIALLY_PAID
    else:
        invoice.status = Invoice.Status.ISSUED
    invoice.save(update_fields=["status", "updated_at"])
    return invoice


def create_invoice(*, actor, request=None, **validated_data) -> Invoice:
    with transaction.atomic():
        invoice = Invoice.objects.create(created_by=actor, **validated_data)
        record_audit_event(
            user=actor,
            action="INVOICE_CREATED",
            entity_type="Invoice",
            entity_id=invoice.pk,
            new_data={"patient": invoice.patient_id, "status": invoice.status},
            request=request,
        )
        return invoice


def ensure_invoice_draft(invoice: Invoice):
    if invoice.status != Invoice.Status.DRAFT:
        raise ValidationError("Only draft invoices can be edited.")


def default_item_values_from_source(data: dict) -> dict:
    service = data.get("billable_service")
    care = data.get("care")
    care_session = data.get("care_session")
    if care_session:
        session_care = care_session.care
        if care and care.pk != session_care.pk:
            raise ValidationError("Care session must belong to the selected care.")
        if InvoiceItem.objects.filter(care=session_care).exists():
            raise ValidationError("Care already has a billing line.")
        data.setdefault("description", session_care.care_type.name)
        data.setdefault("quantity", Decimal("1.00"))
        data.setdefault("unit_price", session_care.price_per_session)
        data.setdefault("discount_amount", MONEY_ZERO)
        return data
    if service:
        data.setdefault("description", service.name)
        data.setdefault("unit_price", service.default_unit_price)
    if care:
        data.setdefault("description", str(care.care_type.name))
        data.setdefault("quantity", Decimal(care.planned_sessions))
        data.setdefault("unit_price", care.price_per_session)
    data.setdefault("quantity", Decimal("1.00"))
    data.setdefault("unit_price", MONEY_ZERO)
    data.setdefault("discount_amount", MONEY_ZERO)
    return data


def create_invoice_item(*, actor, request=None, **validated_data) -> InvoiceItem:
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=validated_data["invoice"].pk)
        ensure_invoice_draft(invoice)
        validated_data["invoice"] = invoice
        item = InvoiceItem(**default_item_values_from_source(validated_data))
        item.save()
        record_audit_event(
            user=actor,
            action="INVOICE_ITEM_ADDED",
            entity_type="InvoiceItem",
            entity_id=item.pk,
            new_data={"invoice": invoice.pk, "net_amount": str(item.net_amount)},
            request=request,
        )
        return item


def update_invoice_item(*, item: InvoiceItem, actor, request=None, **validated_data) -> InvoiceItem:
    with transaction.atomic():
        item = InvoiceItem.objects.select_for_update().select_related("invoice").get(pk=item.pk)
        ensure_invoice_draft(item.invoice)
        old_data = {"net_amount": str(item.net_amount), "description": item.description}
        for field, value in validated_data.items():
            setattr(item, field, value)
        item.save()
        record_audit_event(
            user=actor,
            action="INVOICE_ITEM_CHANGED",
            entity_type="InvoiceItem",
            entity_id=item.pk,
            old_data=old_data,
            new_data={"net_amount": str(item.net_amount), "description": item.description},
            request=request,
        )
        return item


def delete_invoice_item(*, item: InvoiceItem, actor, request=None):
    with transaction.atomic():
        item = InvoiceItem.objects.select_for_update().select_related("invoice").get(pk=item.pk)
        ensure_invoice_draft(item.invoice)
        old_data = {"invoice": item.invoice_id, "net_amount": str(item.net_amount)}
        item.delete()
        record_audit_event(
            user=actor,
            action="INVOICE_ITEM_CHANGED",
            entity_type="InvoiceItem",
            entity_id=old_data["invoice"],
            old_data=old_data,
            request=request,
        )


def issue_invoice(*, invoice: Invoice, actor, request=None) -> Invoice:
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().prefetch_related("items").get(pk=invoice.pk)
        if invoice.status != Invoice.Status.DRAFT:
            raise ValidationError("Only draft invoices can be issued.")
        if not invoice.items.exists():
            raise ValidationError("Invoice must contain at least one item before issue.")
        invoice.full_clean()
        if not invoice.invoice_number:
            invoice.invoice_number = next_financial_number(key="invoice", prefix="INV")
        invoice.status = Invoice.Status.ISSUED
        invoice.finalized_by = actor
        invoice.finalized_at = timezone.now()
        invoice.save(update_fields=["invoice_number", "status", "finalized_by", "finalized_at", "updated_at"])
        record_audit_event(
            user=actor,
            action="INVOICE_ISSUED",
            entity_type="Invoice",
            entity_id=invoice.pk,
            new_data={"invoice_number": invoice.invoice_number, "total": str(invoice.total)},
            request=request,
        )
        return invoice


def cancel_invoice(*, invoice: Invoice, actor, reason: str, request=None) -> Invoice:
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if invoice.status == Invoice.Status.CANCELLED:
            raise ValidationError("Invoice is already cancelled.")
        if invoice.paid_amount > MONEY_ZERO:
            raise ValidationError("Invoice with completed payments cannot be cancelled.")
        invoice.status = Invoice.Status.CANCELLED
        invoice.cancelled_by = actor
        invoice.cancelled_at = timezone.now()
        invoice.cancellation_reason = reason
        invoice.save(update_fields=["status", "cancelled_by", "cancelled_at", "cancellation_reason", "updated_at"])
        record_audit_event(
            user=actor,
            action="INVOICE_CANCELLED",
            entity_type="Invoice",
            entity_id=invoice.pk,
            new_data={"reason": reason},
            request=request,
        )
        return invoice


def update_invoice_discount(*, invoice: Invoice, discount_amount: Decimal, actor, request=None) -> Invoice:
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
        ensure_invoice_draft(invoice)
        old_data = {"discount_amount": str(invoice.discount_amount)}
        invoice.discount_amount = discount_amount
        invoice.full_clean()
        invoice.save(update_fields=["discount_amount", "updated_at"])
        record_audit_event(
            user=actor,
            action="INVOICE_DISCOUNT_CHANGED",
            entity_type="Invoice",
            entity_id=invoice.pk,
            old_data=old_data,
            new_data={"discount_amount": str(invoice.discount_amount)},
            request=request,
        )
        return invoice


def upsert_billable_service_audit(*, service: BillableService, actor, request=None, old_data=None):
    record_audit_event(
        user=actor,
        action="BILLABLE_SERVICE_UPDATED" if old_data else "BILLABLE_SERVICE_CREATED",
        entity_type="BillableService",
        entity_id=service.pk,
        old_data=old_data,
        new_data={"code": service.code, "default_unit_price": str(service.default_unit_price)},
        request=request,
    )
