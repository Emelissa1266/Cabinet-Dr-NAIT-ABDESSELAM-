from django.conf import settings
from django.db import models
from django.db.models import Q


class Notification(models.Model):
    class Type(models.TextChoices):
        APPOINTMENT = "APPOINTMENT", "Appointment"
        SURGERY = "SURGERY", "Surgery"
        PREOPERATIVE = "PREOPERATIVE", "Pre-operative"
        CARE = "CARE", "Care"
        BILLING = "BILLING", "Billing"
        SYSTEM = "SYSTEM", "System"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=30, choices=Type.choices)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)
    title = models.CharField(max_length=180)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(blank=True, null=True)
    deduplication_key = models.CharField(max_length=180, blank=True, null=True)
    patient = models.ForeignKey("patients.Patient", on_delete=models.SET_NULL, blank=True, null=True, related_name="notifications")
    appointment = models.ForeignKey(
        "agenda.Appointment",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="notifications",
    )
    surgery = models.ForeignKey("surgery.Surgery", on_delete=models.SET_NULL, blank=True, null=True, related_name="notifications")
    care = models.ForeignKey("care.Care", on_delete=models.SET_NULL, blank=True, null=True, related_name="notifications")
    care_session = models.ForeignKey(
        "care.CareSession",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="notifications",
    )
    invoice = models.ForeignKey("billing.Invoice", on_delete=models.SET_NULL, blank=True, null=True, related_name="notifications")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("recipient", "is_read", "created_at")),
            models.Index(fields=("notification_type", "priority")),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("deduplication_key",),
                condition=Q(deduplication_key__isnull=False),
                name="unique_notification_deduplication_key",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.recipient}: {self.title}"
