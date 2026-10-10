from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.billing.models import MONEY_ZERO, Invoice
from apps.billing.services import (
    invoice_allocatable_amount,
    next_financial_number,
    recalculate_invoice_status,
)

from .models import Payment, PaymentAllocation, Receipt


def create_payment(*, actor, request=None, **validated_data) -> Payment:
    with transaction.atomic():
        payment = Payment.objects.create(received_by=actor, **validated_data)
        if not payment.payment_number:
            payment.payment_number = next_financial_number(key="payment", prefix="PAY")
            payment.save(update_fields=["payment_number"])
        record_audit_event(
            user=actor,
            action="PAYMENT_CREATED",
            entity_type="Payment",
            entity_id=payment.pk,
            new_data={"payment_number": payment.payment_number, "amount": str(payment.amount)},
            request=request,
        )
        return payment


def allocate_payment(*, payment: Payment, invoice: Invoice, amount: Decimal, actor, request=None) -> PaymentAllocation:
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if payment.status == Payment.Status.CANCELLED:
            raise ValidationError("Cancelled payments cannot be allocated.")
        if amount <= MONEY_ZERO:
            raise ValidationError("Allocation amount must be greater than zero.")
        if payment.patient_id != invoice.patient_id:
            raise ValidationError("Payment and invoice must belong to the same patient.")
        if amount > payment.unallocated_amount:
            raise ValidationError("Allocation exceeds unallocated payment amount.")
        if invoice.status in {Invoice.Status.DRAFT, Invoice.Status.CANCELLED}:
            raise ValidationError("Payments can only be allocated to issued invoices.")
        if amount > invoice_allocatable_amount(invoice):
            raise ValidationError("Allocation exceeds invoice remaining amount.")
        allocation = PaymentAllocation.objects.create(payment=payment, invoice=invoice, amount=amount)
        record_audit_event(
            user=actor,
            action="PAYMENT_ALLOCATED",
            entity_type="PaymentAllocation",
            entity_id=allocation.pk,
            new_data={"payment": payment.pk, "invoice": invoice.pk, "amount": str(amount)},
            request=request,
        )
        if payment.status == Payment.Status.COMPLETED:
            recalculate_invoice_status(invoice)
        return allocation


def create_receipt(*, payment: Payment, actor, request=None) -> Receipt:
    receipt, created = Receipt.objects.get_or_create(
        payment=payment,
        defaults={
            "patient": payment.patient,
            "issued_by": actor,
            "receipt_number": next_financial_number(key="receipt", prefix="REC"),
        },
    )
    if created:
        record_audit_event(
            user=actor,
            action="RECEIPT_CREATED",
            entity_type="Receipt",
            entity_id=receipt.pk,
            new_data={"receipt_number": receipt.receipt_number, "payment": payment.pk},
            request=request,
        )
    return receipt


def complete_payment(*, payment: Payment, actor, request=None) -> Payment:
    with transaction.atomic():
        payment = Payment.objects.select_for_update().prefetch_related("allocations__invoice").get(pk=payment.pk)
        if payment.status == Payment.Status.CANCELLED:
            raise ValidationError("Cancelled payments cannot be completed.")
        if payment.status == Payment.Status.COMPLETED:
            raise ValidationError("Payment is already completed.")
        for allocation in payment.allocations.all():
            invoice = Invoice.objects.select_for_update().get(pk=allocation.invoice_id)
            if allocation.amount > invoice.remaining_amount:
                raise ValidationError("Completing this payment would overpay an invoice.")
        payment.status = Payment.Status.COMPLETED
        payment.save(update_fields=["status", "updated_at"])
        for allocation in payment.allocations.all():
            recalculate_invoice_status(allocation.invoice)
        create_receipt(payment=payment, actor=actor, request=request)
        record_audit_event(
            user=actor,
            action="PAYMENT_COMPLETED",
            entity_type="Payment",
            entity_id=payment.pk,
            new_data={"payment_number": payment.payment_number},
            request=request,
        )
        return payment


def cancel_payment(*, payment: Payment, actor, reason: str, request=None) -> Payment:
    with transaction.atomic():
        payment = Payment.objects.select_for_update().prefetch_related("allocations__invoice").get(pk=payment.pk)
        if payment.status == Payment.Status.CANCELLED:
            raise ValidationError("Payment is already cancelled.")
        old_status = payment.status
        payment.status = Payment.Status.CANCELLED
        payment.cancelled_by = actor
        payment.cancelled_at = timezone.now()
        payment.cancellation_reason = reason
        payment.save(
            update_fields=["status", "cancelled_by", "cancelled_at", "cancellation_reason", "updated_at"],
        )
        for allocation in payment.allocations.all():
            recalculate_invoice_status(allocation.invoice)
        record_audit_event(
            user=actor,
            action="PAYMENT_CANCELLED",
            entity_type="Payment",
            entity_id=payment.pk,
            old_data={"status": old_status},
            new_data={"status": payment.status, "reason": reason},
            request=request,
        )
        return payment
