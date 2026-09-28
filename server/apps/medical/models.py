from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.accounts.models import User
from apps.patients.models import Patient


def validate_doctor(user):
    if user and user.role != User.Role.DOCTOR:
        raise ValidationError("Clinical author must be a doctor.")


class Consultation(models.Model):
    class ConsultationType(models.TextChoices):
        INITIAL = "INITIAL", "Initial"
        FOLLOW_UP = "FOLLOW_UP", "Follow-up"
        PRE_OPERATIVE = "PRE_OPERATIVE", "Pre-operative"
        POST_OPERATIVE = "POST_OPERATIVE", "Post-operative"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="consultations")
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="consultations",
    )
    consultation_date = models.DateTimeField()
    consultation_type = models.CharField(
        max_length=30,
        choices=ConsultationType.choices,
        default=ConsultationType.INITIAL,
    )
    reason = models.CharField(max_length=255)
    patient_complaint = models.TextField(blank=True)
    clinical_findings = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    treatment_plan = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-consultation_date", "-created_at")
        indexes = [
            models.Index(fields=("patient", "consultation_date")),
            models.Index(fields=("doctor", "consultation_date")),
            models.Index(fields=("status",)),
        ]

    def clean(self):
        validate_doctor(self.doctor)

    def __str__(self) -> str:
        return f"{self.patient.patient_reference} consultation {self.consultation_date:%Y-%m-%d}"


class Prescription(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        CANCELLED = "CANCELLED", "Cancelled"
        COMPLETED = "COMPLETED", "Completed"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="prescriptions")
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="prescriptions",
    )
    surgery = models.ForeignKey(
        "surgery.Surgery",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="prescriptions",
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="prescriptions",
    )
    prescribed_at = models.DateTimeField()
    general_instructions = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-prescribed_at", "-created_at")
        indexes = [
            models.Index(fields=("patient", "prescribed_at")),
            models.Index(fields=("doctor", "prescribed_at")),
            models.Index(fields=("status",)),
        ]

    def clean(self):
        validate_doctor(self.doctor)
        if self.consultation_id and self.consultation.patient_id != self.patient_id:
            raise ValidationError("Prescription patient must match the consultation patient.")
        if self.surgery_id and self.surgery.patient_id != self.patient_id:
            raise ValidationError("Prescription patient must match the surgery patient.")

    def __str__(self) -> str:
        return f"Prescription {self.pk} for {self.patient.patient_reference}"


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name="items")
    medication_name = models.CharField(max_length=180)
    dosage = models.CharField(max_length=120)
    frequency = models.CharField(max_length=120)
    route = models.CharField(max_length=120, blank=True)
    duration = models.CharField(max_length=120, blank=True)
    quantity = models.PositiveIntegerField(blank=True, null=True)
    instructions = models.TextField(blank=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("id",)

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError("Prescription item end date cannot precede start date.")

    def __str__(self) -> str:
        return self.medication_name


class MedicalInstruction(models.Model):
    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="medical_instructions")
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="medical_instructions",
    )
    surgery = models.ForeignKey(
        "surgery.Surgery",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="medical_instructions",
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="medical_instructions",
    )
    title = models.CharField(max_length=180)
    instruction = models.TextField()
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    valid_from = models.DateTimeField(blank=True, null=True)
    valid_until = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("patient", "status")),
            models.Index(fields=("priority", "status")),
        ]

    def clean(self):
        validate_doctor(self.doctor)
        if self.consultation_id and self.consultation.patient_id != self.patient_id:
            raise ValidationError("Instruction patient must match the consultation patient.")
        if self.surgery_id and self.surgery.patient_id != self.patient_id:
            raise ValidationError("Instruction patient must match the surgery patient.")
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValidationError("valid_until cannot precede valid_from.")

    def __str__(self) -> str:
        return self.title
