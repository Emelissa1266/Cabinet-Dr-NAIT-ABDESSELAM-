from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.agenda.models import Appointment
from apps.care.models import Care
from apps.medical.models import Consultation, Prescription
from apps.patients.models import Patient
from apps.surgery.models import PreoperativeRequirement, Surgery, SurgeryConsent

from .storage import private_media_storage
from .validators import generated_storage_key


def document_upload_to(instance, filename):
    return generated_storage_key("documents", filename)


def clinical_photo_upload_to(instance, filename):
    return generated_storage_key("clinical-photos", filename)


class DocumentCategory(models.Model):
    class SystemType(models.TextChoices):
        CLINICAL = "CLINICAL", "Clinical"
        ADMINISTRATIVE = "ADMINISTRATIVE", "Administrative"
        CONSENT = "CONSENT", "Consent"
        OTHER = "OTHER", "Other"

    code = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    system_type = models.CharField(max_length=30, choices=SystemType.choices, default=SystemType.OTHER)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Document(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="documents")
    category = models.ForeignKey(DocumentCategory, on_delete=models.PROTECT, related_name="documents")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=document_upload_to, storage=private_media_storage)
    original_filename = models.CharField(max_length=255)
    stored_filename = models.CharField(max_length=500, editable=False)
    mime_type = models.CharField(max_length=120)
    file_size = models.PositiveBigIntegerField()
    checksum = models.CharField(max_length=64, db_index=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="documents_uploaded")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    document_date = models.DateField(blank=True, null=True)
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="documents",
    )
    surgery = models.ForeignKey(Surgery, on_delete=models.SET_NULL, blank=True, null=True, related_name="documents")
    prescription = models.ForeignKey(
        Prescription,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="documents",
    )
    care = models.ForeignKey(Care, on_delete=models.SET_NULL, blank=True, null=True, related_name="documents")
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="documents",
    )
    surgery_consent = models.ForeignKey(
        SurgeryConsent,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="documents",
    )
    preoperative_requirement = models.ForeignKey(
        PreoperativeRequirement,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="documents",
    )
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(blank=True, null=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="documents_archived",
    )
    archive_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-uploaded_at", "-created_at")
        indexes = [
            models.Index(fields=("patient", "is_archived")),
            models.Index(fields=("uploaded_at",)),
            models.Index(fields=("document_date",)),
        ]

    def clean(self):
        if self.category_id and not self.category.is_active and not self.pk:
            raise ValidationError("Inactive document categories cannot be used for new documents.")
        if self.surgery_consent_id and self.category.system_type != DocumentCategory.SystemType.CONSENT:
            raise ValidationError("Surgery consent files must use a consent document category.")
        source_patient_ids = {
            "consultation": self.consultation.patient_id if self.consultation_id else None,
            "surgery": self.surgery.patient_id if self.surgery_id else None,
            "prescription": self.prescription.patient_id if self.prescription_id else None,
            "care": self.care.patient_id if self.care_id else None,
            "appointment": self.appointment.patient_id if self.appointment_id else None,
            "surgery_consent": self.surgery_consent.surgery.patient_id if self.surgery_consent_id else None,
            "preoperative_requirement": (
                self.preoperative_requirement.surgery.patient_id if self.preoperative_requirement_id else None
            ),
        }
        for source, patient_id in source_patient_ids.items():
            if patient_id and patient_id != self.patient_id:
                raise ValidationError(f"{source} patient must match document patient.")

    def save(self, *args, **kwargs):
        if not self.stored_filename:
            self.stored_filename = self.file.name or "pending"
        self.full_clean()
        result = super().save(*args, **kwargs)
        if self.stored_filename != self.file.name:
            self.stored_filename = self.file.name
            super().save(update_fields=["stored_filename", "updated_at"])
        return result

    def __str__(self) -> str:
        return self.title


class ClinicalPhotoSet(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="clinical_photo_sets")
    surgery = models.ForeignKey(
        Surgery,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="clinical_photo_sets",
    )
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="clinical_photo_sets",
    )
    title = models.CharField(max_length=180)
    anatomical_area = models.CharField(max_length=80)
    captured_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="photo_sets_created")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-captured_at", "-created_at")

    def clean(self):
        if self.surgery_id and self.surgery.patient_id != self.patient_id:
            raise ValidationError("Photo set patient must match surgery patient.")
        if self.consultation_id and self.consultation.patient_id != self.patient_id:
            raise ValidationError("Photo set patient must match consultation patient.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.title


class ClinicalPhoto(models.Model):
    class PhotoType(models.TextChoices):
        BEFORE = "BEFORE", "Before"
        AFTER = "AFTER", "After"
        PROGRESS = "PROGRESS", "Progress"
        OTHER = "OTHER", "Other"

    class ViewAngle(models.TextChoices):
        FRONT = "FRONT", "Front"
        LEFT = "LEFT", "Left"
        RIGHT = "RIGHT", "Right"
        OBLIQUE_LEFT = "OBLIQUE_LEFT", "Oblique left"
        OBLIQUE_RIGHT = "OBLIQUE_RIGHT", "Oblique right"
        OTHER = "OTHER", "Other"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="clinical_photos")
    surgery = models.ForeignKey(Surgery, on_delete=models.SET_NULL, blank=True, null=True, related_name="clinical_photos")
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="clinical_photos",
    )
    photo_set = models.ForeignKey(
        ClinicalPhotoSet,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="photos",
    )
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="clinical_photos_uploaded")
    image = models.ImageField(upload_to=clinical_photo_upload_to, storage=private_media_storage)
    original_filename = models.CharField(max_length=255)
    stored_filename = models.CharField(max_length=500, editable=False)
    mime_type = models.CharField(max_length=120)
    file_size = models.PositiveBigIntegerField()
    checksum = models.CharField(max_length=64, db_index=True)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    photo_type = models.CharField(max_length=20, choices=PhotoType.choices)
    anatomical_area = models.CharField(max_length=80)
    view_angle = models.CharField(max_length=30, choices=ViewAngle.choices, default=ViewAngle.OTHER)
    captured_at = models.DateTimeField(blank=True, null=True)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(blank=True, null=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="clinical_photos_archived",
    )
    archive_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-captured_at", "-created_at")
        indexes = [
            models.Index(fields=("patient", "photo_type", "is_archived")),
            models.Index(fields=("anatomical_area",)),
            models.Index(fields=("captured_at",)),
        ]

    def clean(self):
        if self.surgery_id and self.surgery.patient_id != self.patient_id:
            raise ValidationError("Photo patient must match surgery patient.")
        if self.consultation_id and self.consultation.patient_id != self.patient_id:
            raise ValidationError("Photo patient must match consultation patient.")
        if self.photo_set_id and self.photo_set.patient_id != self.patient_id:
            raise ValidationError("Photo patient must match photo set patient.")
        if self.photo_set_id and self.surgery_id and self.photo_set.surgery_id and self.photo_set.surgery_id != self.surgery_id:
            raise ValidationError("Photo surgery must match photo set surgery.")

    def save(self, *args, **kwargs):
        if not self.stored_filename:
            self.stored_filename = self.image.name or "pending"
        self.full_clean()
        result = super().save(*args, **kwargs)
        if self.stored_filename != self.image.name:
            self.stored_filename = self.image.name
            super().save(update_fields=["stored_filename", "updated_at"])
        return result

    def __str__(self) -> str:
        return f"{self.photo_type} {self.anatomical_area} for {self.patient.patient_reference}"


class ClinicalPhotoComparison(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="clinical_photo_comparisons")
    surgery = models.ForeignKey(
        Surgery,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="clinical_photo_comparisons",
    )
    before_photo = models.ForeignKey(
        ClinicalPhoto,
        on_delete=models.PROTECT,
        related_name="before_comparisons",
    )
    after_photo = models.ForeignKey(
        ClinicalPhoto,
        on_delete=models.PROTECT,
        related_name="after_comparisons",
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="photo_comparisons_created")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def clean(self):
        if self.before_photo.photo_type != ClinicalPhoto.PhotoType.BEFORE:
            raise ValidationError("before_photo must be classified as BEFORE.")
        if self.after_photo.photo_type not in {ClinicalPhoto.PhotoType.AFTER, ClinicalPhoto.PhotoType.PROGRESS}:
            raise ValidationError("after_photo must be classified as AFTER or PROGRESS.")
        if self.before_photo.patient_id != self.patient_id or self.after_photo.patient_id != self.patient_id:
            raise ValidationError("Comparison photos must belong to the same patient.")
        if self.before_photo.anatomical_area != self.after_photo.anatomical_area:
            raise ValidationError("Comparison photos must use the same anatomical area.")
        if self.surgery_id:
            if self.surgery.patient_id != self.patient_id:
                raise ValidationError("Comparison surgery patient must match comparison patient.")
            if self.before_photo.surgery_id and self.before_photo.surgery_id != self.surgery_id:
                raise ValidationError("Before photo surgery must match comparison surgery.")
            if self.after_photo.surgery_id and self.after_photo.surgery_id != self.surgery_id:
                raise ValidationError("After photo surgery must match comparison surgery.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
