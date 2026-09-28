from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.accounts.models import User
from apps.medical.models import Consultation
from apps.patients.models import Patient


def validate_doctor(user):
    if user and user.role != User.Role.DOCTOR:
        raise ValidationError("Clinical surgery author must be a doctor.")


class Surgery(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PLANNED = "PLANNED", "Planned"
        PREOP_IN_PROGRESS = "PREOP_IN_PROGRESS", "Pre-op in progress"
        READY = "READY", "Ready"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class Laterality(models.TextChoices):
        LEFT = "LEFT", "Left"
        RIGHT = "RIGHT", "Right"
        BILATERAL = "BILATERAL", "Bilateral"
        MIDLINE = "MIDLINE", "Midline"
        NOT_APPLICABLE = "NOT_APPLICABLE", "Not applicable"

    class AnesthesiaType(models.TextChoices):
        LOCAL = "LOCAL", "Local"
        REGIONAL = "REGIONAL", "Regional"
        SEDATION = "SEDATION", "Sedation"
        GENERAL = "GENERAL", "General"
        OTHER = "OTHER", "Other"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="surgeries")
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="surgeries",
    )
    surgeon = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="surgeries_as_surgeon",
    )
    procedure_name = models.CharField(max_length=180)
    procedure_code = models.CharField(max_length=60, blank=True)
    procedure_description = models.TextField(blank=True)
    indication = models.TextField()
    planned_date = models.DateTimeField(blank=True, null=True)
    actual_start_at = models.DateTimeField(blank=True, null=True)
    actual_end_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)
    laterality = models.CharField(max_length=30, choices=Laterality.choices, blank=True)
    anatomical_site = models.CharField(max_length=180, blank=True)
    anesthesia_type = models.CharField(max_length=30, choices=AnesthesiaType.choices, blank=True)
    notes = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="cancelled_surgeries",
    )
    cancelled_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-planned_date", "-created_at")
        indexes = [
            models.Index(fields=("patient", "status")),
            models.Index(fields=("surgeon", "status")),
            models.Index(fields=("planned_date",)),
            models.Index(fields=("actual_start_at",)),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(actual_end_at__isnull=True)
                | models.Q(actual_start_at__isnull=True)
                | models.Q(actual_end_at__gte=models.F("actual_start_at")),
                name="surgery_end_after_start",
            ),
        ]

    def clean(self):
        validate_doctor(self.surgeon)
        if self.consultation_id and self.consultation.patient_id != self.patient_id:
            raise ValidationError("Surgery patient must match consultation patient.")
        if self.actual_start_at and self.actual_end_at and self.actual_end_at < self.actual_start_at:
            raise ValidationError("Surgery end time cannot precede start time.")
        if self.status == self.Status.CANCELLED and not self.cancellation_reason:
            raise ValidationError("Cancellation reason is required for cancelled surgery.")

    def __str__(self) -> str:
        return f"{self.procedure_name} - {self.patient.patient_reference}"


class PreoperativeAssessment(models.Model):
    class FastingStatus(models.TextChoices):
        UNKNOWN = "UNKNOWN", "Unknown"
        CONFIRMED = "CONFIRMED", "Confirmed"
        NOT_FASTED = "NOT_FASTED", "Not fasted"
        NOT_REQUIRED = "NOT_REQUIRED", "Not required"

    class EvaluationStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CLEARED = "CLEARED", "Cleared"
        NEEDS_REVIEW = "NEEDS_REVIEW", "Needs review"
        NOT_REQUIRED = "NOT_REQUIRED", "Not required"

    class PregnancyStatus(models.TextChoices):
        NOT_APPLICABLE = "NOT_APPLICABLE", "Not applicable"
        UNKNOWN = "UNKNOWN", "Unknown"
        NEGATIVE = "NEGATIVE", "Negative"
        POSITIVE = "POSITIVE", "Positive"

    class ReadinessStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        NEEDS_REVIEW = "NEEDS_REVIEW", "Needs review"
        READY = "READY", "Ready"
        NOT_READY = "NOT_READY", "Not ready"

    surgery = models.OneToOneField(Surgery, on_delete=models.CASCADE, related_name="preoperative_assessment")
    assessed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="preop_assessments")
    assessment_date = models.DateTimeField(default=timezone.now)
    medical_history_reviewed = models.BooleanField(default=False)
    allergies_reviewed = models.BooleanField(default=False)
    medications_reviewed = models.BooleanField(default=False)
    contraindications_reviewed = models.BooleanField(default=False)
    fasting_status = models.CharField(max_length=30, choices=FastingStatus.choices, default=FastingStatus.UNKNOWN)
    anesthesia_evaluation_status = models.CharField(
        max_length=30,
        choices=EvaluationStatus.choices,
        default=EvaluationStatus.PENDING,
    )
    required_tests_reviewed = models.BooleanField(default=False)
    pregnancy_status = models.CharField(
        max_length=30,
        choices=PregnancyStatus.choices,
        default=PregnancyStatus.NOT_APPLICABLE,
    )
    readiness_status = models.CharField(
        max_length=30,
        choices=ReadinessStatus.choices,
        default=ReadinessStatus.PENDING,
    )
    assessment_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-assessment_date",)


class PreoperativeChecklistItem(models.Model):
    name = models.CharField(max_length=160, unique=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=120, blank=True)
    is_required = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("sort_order", "name")

    def __str__(self) -> str:
        return self.name


class SurgeryPreoperativeChecklist(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        NOT_APPLICABLE = "NOT_APPLICABLE", "Not applicable"
        BLOCKED = "BLOCKED", "Blocked"

    surgery = models.ForeignKey(Surgery, on_delete=models.CASCADE, related_name="preop_checklists")
    checklist_item = models.ForeignKey(
        PreoperativeChecklistItem,
        on_delete=models.PROTECT,
        related_name="surgery_checks",
    )
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="preop_checks",
    )
    checked_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("checklist_item__sort_order", "checklist_item__name")
        constraints = [
            models.UniqueConstraint(fields=("surgery", "checklist_item"), name="unique_preop_check_per_surgery"),
        ]

    def clean(self):
        if self.status == self.Status.NOT_APPLICABLE:
            if not self.checked_by or self.checked_by.role != User.Role.DOCTOR:
                raise ValidationError("A doctor must mark required checklist items not applicable.")
            if self.checklist_item.is_required and not self.notes.strip():
                raise ValidationError("Justification is required when marking required items not applicable.")


class PreoperativeRequirement(models.Model):
    class RequirementType(models.TextChoices):
        LAB = "LAB", "Lab"
        IMAGING = "IMAGING", "Imaging"
        ANESTHESIA = "ANESTHESIA", "Anesthesia"
        MEDICAL_CLEARANCE = "MEDICAL_CLEARANCE", "Medical clearance"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SATISFIED = "SATISFIED", "Satisfied"
        BLOCKED = "BLOCKED", "Blocked"
        WAIVED = "WAIVED", "Waived"

    surgery = models.ForeignKey(Surgery, on_delete=models.CASCADE, related_name="preop_requirements")
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    requirement_type = models.CharField(max_length=30, choices=RequirementType.choices, default=RequirementType.OTHER)
    required = models.BooleanField(default=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    result_summary = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="reviewed_preop_requirements",
    )
    reviewed_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)


class SurgeryConsent(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        DECLINED = "DECLINED", "Declined"
        REVOKED = "REVOKED", "Revoked"

    surgery = models.ForeignKey(Surgery, on_delete=models.CASCADE, related_name="consents")
    consent_type = models.CharField(max_length=120)
    required = models.BooleanField(default=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="confirmed_surgery_consents",
    )
    confirmed_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("consent_type",)
        constraints = [
            models.UniqueConstraint(fields=("surgery", "consent_type"), name="unique_consent_type_per_surgery"),
        ]


class AnesthesiaRecord(models.Model):
    surgery = models.OneToOneField(Surgery, on_delete=models.CASCADE, related_name="anesthesia_record")
    anesthesia_type = models.CharField(max_length=30, choices=Surgery.AnesthesiaType.choices)
    provider_name = models.CharField(max_length=180, blank=True)
    pre_anesthesia_notes = models.TextField(blank=True)
    intraoperative_notes = models.TextField(blank=True)
    post_anesthesia_notes = models.TextField(blank=True)
    complications = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class SurgeryOperativeRecord(models.Model):
    surgery = models.OneToOneField(Surgery, on_delete=models.CASCADE, related_name="operative_record")
    surgeon = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="operative_records")
    procedure_performed = models.CharField(max_length=180)
    operative_findings = models.TextField()
    operative_technique = models.TextField()
    actual_start_at = models.DateTimeField()
    actual_end_at = models.DateTimeField(blank=True, null=True)
    anesthesia_type = models.CharField(max_length=30, choices=Surgery.AnesthesiaType.choices, blank=True)
    estimated_blood_loss = models.CharField(max_length=80, blank=True)
    complications = models.TextField(blank=True)
    specimens = models.TextField(blank=True)
    drains = models.TextField(blank=True)
    implants_or_devices = models.TextField(blank=True)
    immediate_postoperative_condition = models.TextField()
    operative_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        validate_doctor(self.surgeon)
        if self.actual_end_at and self.actual_end_at < self.actual_start_at:
            raise ValidationError("Operative end time cannot precede start time.")
        if self.surgeon_id != self.surgery.surgeon_id:
            raise ValidationError("Operative record surgeon must match surgery surgeon.")


class SurgeryTeamMember(models.Model):
    class Role(models.TextChoices):
        SURGEON = "SURGEON", "Surgeon"
        ASSISTANT = "ASSISTANT", "Assistant"
        NURSE = "NURSE", "Nurse"
        ANESTHESIA = "ANESTHESIA", "Anesthesia"
        OTHER = "OTHER", "Other"

    surgery = models.ForeignKey(Surgery, on_delete=models.CASCADE, related_name="team_members")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="surgery_team_memberships",
    )
    external_name = models.CharField(max_length=180, blank=True)
    role = models.CharField(max_length=30, choices=Role.choices)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if not self.user and not self.external_name.strip():
            raise ValidationError("Either user or external_name is required.")


class IntraoperativeEvent(models.Model):
    class EventType(models.TextChoices):
        MEDICATION = "MEDICATION", "Medication"
        COMPLICATION = "COMPLICATION", "Complication"
        OBSERVATION = "OBSERVATION", "Observation"
        DEVICE = "DEVICE", "Device"
        OTHER = "OTHER", "Other"

    class Severity(models.TextChoices):
        LOW = "LOW", "Low"
        MODERATE = "MODERATE", "Moderate"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    surgery = models.ForeignKey(Surgery, on_delete=models.CASCADE, related_name="intraoperative_events")
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="intraoperative_events")
    event_type = models.CharField(max_length=30, choices=EventType.choices, default=EventType.OTHER)
    description = models.TextField()
    occurred_at = models.DateTimeField(default=timezone.now)
    severity = models.CharField(max_length=30, choices=Severity.choices, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("occurred_at", "created_at")


class SurgeryComplication(models.Model):
    class Severity(models.TextChoices):
        MINOR = "MINOR", "Minor"
        MODERATE = "MODERATE", "Moderate"
        SEVERE = "SEVERE", "Severe"
        CRITICAL = "CRITICAL", "Critical"

    surgery = models.ForeignKey(Surgery, on_delete=models.CASCADE, related_name="complications")
    complication_type = models.CharField(max_length=160)
    description = models.TextField()
    severity = models.CharField(max_length=30, choices=Severity.choices)
    occurred_at = models.DateTimeField(default=timezone.now)
    identified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="identified_complications")
    action_taken = models.TextField(blank=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("occurred_at", "created_at")

    def clean(self):
        if self.resolved_at and not self.resolved:
            raise ValidationError("resolved_at requires resolved=True.")
        if self.resolved and not self.resolved_at:
            raise ValidationError("resolved_at is required when complication is resolved.")


class PostoperativeAssessment(models.Model):
    surgery = models.ForeignKey(Surgery, on_delete=models.CASCADE, related_name="postoperative_assessments")
    assessed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="postop_assessments")
    assessed_at = models.DateTimeField(default=timezone.now)
    general_condition = models.TextField()
    pain_score = models.PositiveSmallIntegerField(blank=True, null=True, validators=[MaxValueValidator(10)])
    consciousness_status = models.CharField(max_length=120, blank=True)
    wound_status = models.TextField(blank=True)
    bleeding_status = models.CharField(max_length=120, blank=True)
    drain_status = models.CharField(max_length=120, blank=True)
    nausea_vomiting = models.CharField(max_length=120, blank=True)
    complications = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    disposition = models.CharField(max_length=180, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-assessed_at",)

    def clean(self):
        validate_doctor(self.assessed_by)


class PostoperativeFollowUp(models.Model):
    surgery = models.ForeignKey(Surgery, on_delete=models.CASCADE, related_name="follow_ups")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="surgery_follow_ups")
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="surgery_follow_ups")
    follow_up_date = models.DateTimeField()
    recovery_status = models.CharField(max_length=180)
    wound_assessment = models.TextField(blank=True)
    pain_score = models.PositiveSmallIntegerField(blank=True, null=True, validators=[MinValueValidator(0), MaxValueValidator(10)])
    complications = models.TextField(blank=True)
    clinical_findings = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)
    next_follow_up_date = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-follow_up_date",)
        indexes = [
            models.Index(fields=("surgery", "follow_up_date")),
            models.Index(fields=("patient", "follow_up_date")),
            models.Index(fields=("doctor", "follow_up_date")),
        ]

    def clean(self):
        validate_doctor(self.doctor)
        if self.surgery.patient_id != self.patient_id:
            raise ValidationError("Follow-up patient must match surgery patient.")
        if self.next_follow_up_date and self.next_follow_up_date < self.follow_up_date:
            raise ValidationError("Next follow-up date cannot precede follow-up date.")
