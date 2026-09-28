from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        DOCTOR = "DOCTOR", "Doctor"
        NURSE = "NURSE", "Nurse"
        SECRETARY = "SECRETARY", "Secretary"

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.DOCTOR)
    professional_title = models.CharField(max_length=120, blank=True)
    avatar = models.ImageField(upload_to="profiles/avatars/", blank=True, null=True)
    profile_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        full_name = self.get_full_name()
        return full_name or self.username
