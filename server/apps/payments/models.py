from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone

from apps.billing.models import MONEY_ZERO, Invoice
from apps.patients.models import Patient


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        CARD = "CARD", "Card"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank transfer"
        CHEQUE = "CHEQUE", "Cheque"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    payment_number = models.CharField(max_length=24, unique=True, blank=True, null=True, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, default=settings.DEFAULT_CURRENCY)
    payment_method = models.CharField(max_length=30, choices=Method.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    paid_at = models.DateTimeField(default=timezone.now)
    reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="payments_received",
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="payments_cancelled",
    )
    cancelled_at = models.DateTimeField(blank=True, null=True)
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-paid_at", "-created_at")
        indexes = [
            models.Index(fields=("patient", "status")),
            models.Index(fields=("payment_method",)),
            models.Index(fields=("paid_at",)),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="payment_amount_gt_0"),
        ]

    @property
    def allocated_amount(self) -> Decimal:
        aggregate = self.allocations.aggregate(total=Sum("amount"))
        return aggregate["total"] or MONEY_ZERO

    @property
    def unallocated_amount(self) -> Decimal:
        return max(self.amount - self.allocated_amount, MONEY_ZERO)

    def clean(self):
        if self.amount <= MONEY_ZERO:
            raise ValidationError("Payment amount must be greater than zero.")

    def __str__(self) -> str:
        return self.payment_number or f"Payment {self.pk}"


class PaymentAllocation(models.Model):
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="allocations")
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="allocations")
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="payment_allocation_amount_gt_0"),
        ]

    def clean(self):
        if self.amount <= MONEY_ZERO:
            raise ValidationError("Allocation amount must be greater than zero.")
        if self.payment.patient_id != self.invoice.patient_id:
            raise ValidationError("Payment and invoice must belong to the same patient.")
        if self.invoice.status in {Invoice.Status.DRAFT, Invoice.Status.CANCELLED}:
            raise ValidationError("Payments can only be allocated to issued invoices.")

    def __str__(self) -> str:
        return f"{self.payment} -> {self.invoice}: {self.amount}"


class Receipt(models.Model):
    receipt_number = models.CharField(max_length=24, unique=True, blank=True, null=True, editable=False)
    payment = models.OneToOneField(Payment, on_delete=models.PROTECT, related_name="receipt")
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="receipts")
    issued_at = models.DateTimeField(default=timezone.now)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="receipts_issued",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-issued_at", "-created_at")
        indexes = [
            models.Index(fields=("patient",)),
            models.Index(fields=("issued_at",)),
        ]

    def clean(self):
        if self.payment.status != Payment.Status.COMPLETED:
            raise ValidationError("A receipt can only be issued for a completed payment.")
        if self.patient_id != self.payment.patient_id:
            raise ValidationError("Receipt patient must match payment patient.")

    def __str__(self) -> str:
        return self.receipt_number or f"Receipt {self.pk}"
