from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone

from apps.agenda.models import Appointment
from apps.care.models import Care, CareSession
from apps.medical.models import Consultation
from apps.patients.models import Patient
from apps.surgery.models import Surgery

MONEY_ZERO = Decimal("0.00")


class FinancialSequence(models.Model):
    key = models.CharField(max_length=20)
    year = models.PositiveIntegerField()
    current_value = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("key", "year"), name="unique_financial_sequence_key_year"),
        ]

    def __str__(self) -> str:
        return f"{self.key}-{self.year}: {self.current_value}"


class BillableService(models.Model):
    class Category(models.TextChoices):
        CONSULTATION = "CONSULTATION", "Consultation"
        SURGERY = "SURGERY", "Surgery"
        CARE = "CARE", "Care"
        OTHER = "OTHER", "Other"

    code = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    default_unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(MONEY_ZERO)],
    )
    currency = models.CharField(max_length=3, default=settings.DEFAULT_CURRENCY)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("category", "name")
        constraints = [
            models.CheckConstraint(condition=Q(default_unit_price__gte=0), name="billable_price_non_negative"),
        ]

    def __str__(self) -> str:
        return f"{self.code} - {self.name}"


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially paid"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    invoice_number = models.CharField(max_length=24, unique=True, blank=True, null=True, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="invoices")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT, db_index=True)
    currency = models.CharField(max_length=3, default=settings.DEFAULT_CURRENCY)
    issue_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(blank=True, null=True)
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=MONEY_ZERO,
        validators=[MinValueValidator(MONEY_ZERO)],
    )
    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="invoices_created",
    )
    finalized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="invoices_finalized",
    )
    finalized_at = models.DateTimeField(blank=True, null=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="invoices_cancelled",
    )
    cancelled_at = models.DateTimeField(blank=True, null=True)
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-issue_date", "-created_at")
        indexes = [
            models.Index(fields=("patient", "status")),
            models.Index(fields=("issue_date",)),
            models.Index(fields=("due_date",)),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(discount_amount__gte=0), name="invoice_discount_non_negative"),
        ]

    @property
    def subtotal(self) -> Decimal:
        aggregate = self.items.aggregate(total=Sum("net_amount"))
        return aggregate["total"] or MONEY_ZERO

    @property
    def item_discount_total(self) -> Decimal:
        aggregate = self.items.aggregate(total=Sum("discount_amount"))
        return aggregate["total"] or MONEY_ZERO

    @property
    def discount_total(self) -> Decimal:
        return self.item_discount_total + self.discount_amount

    @property
    def total(self) -> Decimal:
        return max(self.subtotal - self.discount_amount, MONEY_ZERO)

    @property
    def paid_amount(self) -> Decimal:
        if self.status == self.Status.CANCELLED:
            return MONEY_ZERO
        aggregate = self.allocations.filter(payment__status="COMPLETED").aggregate(total=Sum("amount"))
        return aggregate["total"] or MONEY_ZERO

    @property
    def remaining_amount(self) -> Decimal:
        if self.status == self.Status.CANCELLED:
            return MONEY_ZERO
        return max(self.total - self.paid_amount, MONEY_ZERO)

    @property
    def is_overdue(self) -> bool:
        return (
            self.due_date is not None
            and self.due_date < timezone.localdate()
            and self.status != self.Status.CANCELLED
            and self.remaining_amount > MONEY_ZERO
        )

    def clean(self):
        if self.discount_amount < MONEY_ZERO:
            raise ValidationError("Invoice discount cannot be negative.")
        if self.pk and self.discount_amount > self.subtotal:
            raise ValidationError("Invoice discount cannot exceed subtotal.")

    def __str__(self) -> str:
        return self.invoice_number or f"Draft invoice {self.pk}"


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    billable_service = models.ForeignKey(
        BillableService,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name="invoice_items",
    )
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=MONEY_ZERO)
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="invoice_items",
    )
    surgery = models.ForeignKey(
        Surgery,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="invoice_items",
    )
    care = models.ForeignKey(Care, on_delete=models.SET_NULL, blank=True, null=True, related_name="invoice_items")
    care_session = models.ForeignKey(
        CareSession,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="invoice_items",
    )
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="invoice_items",
    )
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2, editable=False)
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("id",)
        constraints = [
            models.CheckConstraint(condition=Q(quantity__gt=0), name="invoice_item_quantity_gt_0"),
            models.CheckConstraint(condition=Q(unit_price__gte=0), name="invoice_item_unit_price_non_negative"),
            models.CheckConstraint(condition=Q(discount_amount__gte=0), name="invoice_item_discount_non_negative"),
            models.UniqueConstraint(
                fields=("consultation",),
                condition=Q(consultation__isnull=False),
                name="unique_billed_consultation",
            ),
            models.UniqueConstraint(
                fields=("surgery",),
                condition=Q(surgery__isnull=False),
                name="unique_billed_surgery",
            ),
            models.UniqueConstraint(
                fields=("care",),
                condition=Q(care__isnull=False),
                name="unique_billed_care",
            ),
            models.UniqueConstraint(
                fields=("care_session",),
                condition=Q(care_session__isnull=False),
                name="unique_billed_care_session",
            ),
            models.UniqueConstraint(
                fields=("appointment",),
                condition=Q(appointment__isnull=False),
                name="unique_billed_appointment",
            ),
        ]

    def calculate_amounts(self):
        gross = self.quantity * self.unit_price
        self.gross_amount = gross.quantize(Decimal("0.01"))
        self.net_amount = (gross - self.discount_amount).quantize(Decimal("0.01"))

    def clean(self):
        if self.invoice_id and self.invoice.status != Invoice.Status.DRAFT:
            raise ValidationError("Issued or cancelled invoices cannot have financial items changed.")
        if self.billable_service_id and not self.billable_service.is_active and not self.pk:
            raise ValidationError("Inactive services cannot be added to new invoice items.")
        if self.quantity <= 0:
            raise ValidationError("Quantity must be greater than zero.")
        if self.unit_price < MONEY_ZERO:
            raise ValidationError("Unit price cannot be negative.")
        if self.discount_amount < MONEY_ZERO:
            raise ValidationError("Discount cannot be negative.")
        self.calculate_amounts()
        if self.discount_amount > self.gross_amount:
            raise ValidationError("Discount cannot exceed gross amount.")
        self._validate_sources_match_invoice_patient()

    def _validate_sources_match_invoice_patient(self):
        if not self.invoice_id:
            return
        source_patient_ids = {
            "consultation": self.consultation.patient_id if self.consultation_id else None,
            "surgery": self.surgery.patient_id if self.surgery_id else None,
            "care": self.care.patient_id if self.care_id else None,
            "care_session": self.care_session.care.patient_id if self.care_session_id else None,
            "appointment": self.appointment.patient_id if self.appointment_id else None,
        }
        for source, patient_id in source_patient_ids.items():
            if patient_id and patient_id != self.invoice.patient_id:
                raise ValidationError(f"{source} patient must match invoice patient.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.description
