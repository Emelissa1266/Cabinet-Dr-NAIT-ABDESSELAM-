from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from apps.accounts.models import User
from apps.care.models import CareSession
from apps.medical.models import Consultation
from apps.patients.models import Patient
from apps.surgery.models import Surgery


class AppointmentType(models.Model):
    class Category(models.TextChoices):
        CONSULTATION = "CONSULTATION", "Consultation"
        FOLLOW_UP = "FOLLOW_UP", "Follow-up"
        SURGERY = "SURGERY", "Surgery"
        NURSING_CARE = "NURSING_CARE", "Nursing care"
        PREOPERATIVE = "PREOPERATIVE", "Pre-operative"
        POSTOPERATIVE = "POSTOPERATIVE", "Post-operative"
        OTHER = "OTHER", "Other"

    name = models.CharField(max_length=160)
    code = models.SlugField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    default_duration_minutes = models.PositiveIntegerField()
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    is_active = models.BooleanField(default=True, db_index=True)
    requires_doctor = models.BooleanField(default=False)
    requires_nurse = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.CheckConstraint(
                condition=Q(default_duration_minutes__gt=0),
                name="appointment_type_duration_gt_0",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CHECKED_IN = "CHECKED_IN", "Checked in"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        NO_SHOW = "NO_SHOW", "No show"

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    appointment_type = models.ForeignKey(
        AppointmentType,
        on_delete=models.PROTECT,
        related_name="appointments",
    )
    primary_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="primary_appointments",
    )
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.SCHEDULED)
    reason = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="appointments",
    )
    surgery = models.ForeignKey(
        Surgery,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="appointments",
    )
    care_session = models.ForeignKey(
        CareSession,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="appointments",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="appointments_created",
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="appointments_cancelled",
    )
    cancelled_at = models.DateTimeField(blank=True, null=True)
    cancellation_reason = models.TextField(blank=True)
    checked_in_at = models.DateTimeField(blank=True, null=True)
    no_show_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("start_at",)
        indexes = [
            models.Index(fields=("patient", "start_at")),
            models.Index(fields=("primary_staff", "start_at")),
            models.Index(fields=("status", "start_at")),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(start_at__lt=F("end_at")), name="appointment_start_before_end"),
        ]

    def clean(self):
        if self.start_at and self.end_at and self.start_at >= self.end_at:
            raise ValidationError("Appointment start_at must be before end_at.")
        if self.appointment_type_id and not self.appointment_type.is_active and not self.pk:
            raise ValidationError("Inactive appointment types cannot be used for new appointments.")
        if self.appointment_type_id and self.primary_staff_id:
            if self.appointment_type.requires_doctor and self.primary_staff.role != User.Role.DOCTOR:
                raise ValidationError("This appointment type requires doctor primary staff.")
            if self.appointment_type.requires_nurse and self.primary_staff.role != User.Role.NURSE:
                raise ValidationError("This appointment type requires nurse primary staff.")
        if self.consultation_id and self.consultation.patient_id != self.patient_id:
            raise ValidationError("Appointment patient must match consultation patient.")
        if self.surgery_id and self.surgery.patient_id != self.patient_id:
            raise ValidationError("Appointment patient must match surgery patient.")
        if self.care_session_id and self.care_session.care.patient_id != self.patient_id:
            raise ValidationError("Appointment patient must match care session patient.")


class AppointmentStaff(models.Model):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="staff_members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="appointment_participations")
    role = models.CharField(max_length=80, blank=True)
    is_required = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(fields=("appointment", "user"), name="unique_staff_per_appointment"),
        ]


class StaffWorkingHours(models.Model):
    class Weekday(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    staff = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="working_hours")
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("staff", "weekday", "start_time")
        indexes = [models.Index(fields=("staff", "weekday", "is_active"))]
        constraints = [
            models.CheckConstraint(condition=Q(start_time__lt=F("end_time")), name="working_hours_start_before_end"),
        ]

    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError("Working-hours start_time must be before end_time.")


class StaffTimeOff(models.Model):
    class Reason(models.TextChoices):
        LEAVE = "LEAVE", "Leave"
        SICK = "SICK", "Sick"
        TRAINING = "TRAINING", "Training"
        PERSONAL = "PERSONAL", "Personal"
        OTHER = "OTHER", "Other"

    staff = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="time_off")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    reason = models.CharField(max_length=30, choices=Reason.choices, default=Reason.OTHER)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="time_off_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("start_at",)
        constraints = [
            models.CheckConstraint(condition=Q(start_at__lt=F("end_at")), name="time_off_start_before_end"),
        ]

    def clean(self):
        if self.start_at >= self.end_at:
            raise ValidationError("Time-off start_at must be before end_at.")


class ClinicClosure(models.Model):
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    reason = models.CharField(max_length=180)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="clinic_closures_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("start_at",)
        constraints = [
            models.CheckConstraint(condition=Q(start_at__lt=F("end_at")), name="closure_start_before_end"),
        ]

    def clean(self):
        if self.start_at >= self.end_at:
            raise ValidationError("Clinic closure start_at must be before end_at.")


class AppointmentReschedule(models.Model):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="reschedules")
    old_start_at = models.DateTimeField()
    old_end_at = models.DateTimeField()
    new_start_at = models.DateTimeField()
    new_end_at = models.DateTimeField()
    reason = models.TextField(blank=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="appointment_reschedules")
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-changed_at",)
