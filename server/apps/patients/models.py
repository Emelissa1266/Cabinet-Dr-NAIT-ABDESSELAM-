from typing import ClassVar

from django.conf import settings
from django.db import models


class Patient(models.Model):
    class Gender(models.TextChoices):
        FEMALE = "FEMALE", "Female"
        MALE = "MALE", "Male"
        OTHER = "OTHER", "Other"
        UNKNOWN = "UNKNOWN", "Unknown"

    patient_reference = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        blank=True,
        editable=False,
    )
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    date_of_birth = models.DateField(blank=True, null=True)
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        default=Gender.UNKNOWN,
    )
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    emergency_contact = models.CharField(max_length=180, blank=True)
    emergency_phone = models.CharField(max_length=32, blank=True)
    profession = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="patients_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="patients_updated",
    )

    class Meta:
        ordering = ("last_name", "first_name")
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=("last_name", "first_name")),
            models.Index(fields=("phone",)),
            models.Index(fields=("city",)),
        ]

    def save(self, *args, **kwargs):
        needs_reference = not self.patient_reference
        super().save(*args, **kwargs)
        if needs_reference:
            self.patient_reference = f"P-{self.pk:05d}"
            super().save(update_fields=["patient_reference", "updated_at"])

    def __str__(self) -> str:
        return f"{self.patient_reference} - {self.first_name} {self.last_name}"


class PatientMedicalInfoBase(models.Model):
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="%(class)ss",
    )
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="%(class)ss_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title


class PatientAllergy(PatientMedicalInfoBase):
    severity = models.CharField(max_length=80, blank=True)


class PatientMedicalHistory(PatientMedicalInfoBase):
    pass


class PatientSurgicalHistory(PatientMedicalInfoBase):
    surgery_date = models.DateField(blank=True, null=True)


class PatientChronicCondition(PatientMedicalInfoBase):
    diagnosed_at = models.DateField(blank=True, null=True)


class PatientMedication(PatientMedicalInfoBase):
    dosage = models.CharField(max_length=120, blank=True)
    frequency = models.CharField(max_length=120, blank=True)


class PatientContraindication(PatientMedicalInfoBase):
    pass


class PatientClinicalNote(models.Model):
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="clinical_notes",
    )
    note = models.TextField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="patient_clinical_notes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Clinical note for {self.patient.patient_reference}"
