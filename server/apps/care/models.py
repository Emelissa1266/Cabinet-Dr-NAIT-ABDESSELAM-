from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.accounts.models import User
from apps.medical.models import Consultation, MedicalInstruction
from apps.patients.models import Patient


def validate_doctor(user):
    if user and user.role != User.Role.DOCTOR:
        raise ValidationError("Care prescription author must be a doctor.")


def validate_nurse(user):
    if user and user.role != User.Role.NURSE:
        raise ValidationError("Nursing execution user must be a nurse.")


class CareCategory(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name_plural = "Care categories"

    def __str__(self) -> str:
        return self.name


class CareType(models.Model):
    category = models.ForeignKey(CareCategory, on_delete=models.PROTECT, related_name="care_types")
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    default_duration_minutes = models.PositiveIntegerField(blank=True, null=True)
    default_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    requires_vital_signs = models.BooleanField(default=False)
    requires_observation = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("category__name", "name")
        constraints = [
            models.UniqueConstraint(fields=("category", "name"), name="unique_care_type_per_category"),
            models.CheckConstraint(
                condition=models.Q(default_price__gte=0) | models.Q(default_price__isnull=True),
                name="care_type_default_price_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Care(models.Model):
    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planned"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="cares")
    care_type = models.ForeignKey(CareType, on_delete=models.PROTECT, related_name="cares")
    prescribed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="prescribed_cares",
    )
    assigned_nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="assigned_cares",
    )
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="cares",
    )
    medical_instruction = models.ForeignKey(
        MedicalInstruction,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="cares",
    )
    surgery = models.ForeignKey(
        "surgery.Surgery",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="cares",
    )
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    planned_sessions = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    price_per_session = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-start_date", "-created_at")
        indexes = [
            models.Index(fields=("patient", "status")),
            models.Index(fields=("assigned_nurse", "status")),
            models.Index(fields=("prescribed_by", "status")),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(planned_sessions__gt=0), name="care_planned_sessions_gt_0"),
            models.CheckConstraint(condition=models.Q(price_per_session__gte=0), name="care_price_non_negative"),
        ]

    @property
    def total_price(self):
        return self.price_per_session * self.planned_sessions

    @property
    def completed_sessions(self):
        return self.sessions.filter(status=CareSession.Status.COMPLETED).count()

    @property
    def remaining_sessions(self):
        return max(self.planned_sessions - self.completed_sessions, 0)

    @property
    def progress_percentage(self):
        if self.planned_sessions <= 0:
            return 0
        return round((self.completed_sessions / self.planned_sessions) * 100, 2)

    def clean(self):
        validate_doctor(self.prescribed_by)
        if self.assigned_nurse:
            validate_nurse(self.assigned_nurse)
        if self.consultation_id and self.consultation.patient_id != self.patient_id:
            raise ValidationError("Care patient must match consultation patient.")
        if self.medical_instruction_id and self.medical_instruction.patient_id != self.patient_id:
            raise ValidationError("Care patient must match instruction patient.")
        if self.surgery_id and self.surgery.patient_id != self.patient_id:
            raise ValidationError("Care patient must match surgery patient.")
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError("Care end date cannot precede start date.")

    def __str__(self) -> str:
        return f"{self.care_type.name} for {self.patient.patient_reference}"


class CareSession(models.Model):
    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planned"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    care = models.ForeignKey(Care, on_delete=models.CASCADE, related_name="sessions")
    nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="care_sessions",
    )
    scheduled_at = models.DateTimeField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("scheduled_at", "created_at")
        indexes = [
            models.Index(fields=("care", "status")),
            models.Index(fields=("nurse", "status")),
            models.Index(fields=("scheduled_at",)),
        ]

    def clean(self):
        validate_nurse(self.nurse)
        if self.care.assigned_nurse_id and self.nurse_id != self.care.assigned_nurse_id:
            raise ValidationError("Session nurse must match the assigned care nurse.")
        if self.started_at and self.completed_at and self.completed_at < self.started_at:
            raise ValidationError("completed_at cannot precede started_at.")

    def __str__(self) -> str:
        return f"Session {self.pk} - {self.care}"


class CareObservation(models.Model):
    care_session = models.ForeignKey(CareSession, on_delete=models.CASCADE, related_name="observations")
    nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="care_observations",
    )
    observation = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)

    def clean(self):
        validate_nurse(self.nurse)
        if self.care_session.nurse_id != self.nurse_id:
            raise ValidationError("Observation nurse must match the care session nurse.")


class ClinicalMeasurement(models.Model):
    class MeasurementType(models.TextChoices):
        TEMPERATURE = "TEMPERATURE", "Temperature"
        BLOOD_PRESSURE = "BLOOD_PRESSURE", "Blood pressure"
        HEART_RATE = "HEART_RATE", "Heart rate"
        OXYGEN_SATURATION = "OXYGEN_SATURATION", "Oxygen saturation"
        WEIGHT = "WEIGHT", "Weight"
        PAIN_SCORE = "PAIN_SCORE", "Pain score"
        OTHER = "OTHER", "Other"

    care_session = models.ForeignKey(CareSession, on_delete=models.CASCADE, related_name="measurements")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="clinical_measurements",
    )
    measurement_type = models.CharField(max_length=40, choices=MeasurementType.choices)
    value = models.CharField(max_length=80)
    unit = models.CharField(max_length=40)
    recorded_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-recorded_at",)
        indexes = [
            models.Index(fields=("measurement_type", "recorded_at")),
            models.Index(fields=("recorded_by", "recorded_at")),
        ]

    def clean(self):
        validate_nurse(self.recorded_by)
        if not self.value.strip():
            raise ValidationError("Measurement value is required.")
        if not self.unit.strip():
            raise ValidationError("Measurement unit is required.")
        if self.care_session.nurse_id != self.recorded_by_id:
            raise ValidationError("Measurement recorder must match the care session nurse.")


class CareSessionMaterial(models.Model):
    care_session = models.ForeignKey(CareSession, on_delete=models.CASCADE, related_name="materials")
    name = models.CharField(max_length=180)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    unit = models.CharField(max_length=40)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="care_session_materials",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="care_material_quantity_gt_0"),
        ]

    def clean(self):
        validate_nurse(self.recorded_by)
        if self.care_session.nurse_id != self.recorded_by_id:
            raise ValidationError("Material recorder must match the care session nurse.")


class CareParameterDefinition(models.Model):
    class DataType(models.TextChoices):
        TEXT = "TEXT", "Text"
        NUMBER = "NUMBER", "Number"
        BOOLEAN = "BOOLEAN", "Boolean"
        DATE = "DATE", "Date"

    care_type = models.ForeignKey(CareType, on_delete=models.CASCADE, related_name="parameter_definitions")
    key = models.SlugField(max_length=80)
    label = models.CharField(max_length=160)
    data_type = models.CharField(max_length=20, choices=DataType.choices, default=DataType.TEXT)
    unit = models.CharField(max_length=40, blank=True)
    required = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("care_type__name", "key")
        constraints = [
            models.UniqueConstraint(fields=("care_type", "key"), name="unique_parameter_key_per_care_type"),
        ]

    def __str__(self) -> str:
        return f"{self.care_type.name}: {self.key}"


class CareSessionParameter(models.Model):
    care_session = models.ForeignKey(CareSession, on_delete=models.CASCADE, related_name="parameters")
    parameter_definition = models.ForeignKey(
        CareParameterDefinition,
        on_delete=models.PROTECT,
        related_name="session_values",
    )
    value = models.CharField(max_length=255)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="care_session_parameters",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("parameter_definition__key",)
        constraints = [
            models.UniqueConstraint(
                fields=("care_session", "parameter_definition"),
                name="unique_parameter_value_per_session",
            ),
        ]

    def clean(self):
        validate_nurse(self.recorded_by)
        if self.care_session.nurse_id != self.recorded_by_id:
            raise ValidationError("Parameter recorder must match the care session nurse.")
        if self.parameter_definition.care_type_id != self.care_session.care.care_type_id:
            raise ValidationError("Parameter definition must belong to the session care type.")
        if self.parameter_definition.required and not self.value.strip():
            raise ValidationError("Required parameter value cannot be blank.")
