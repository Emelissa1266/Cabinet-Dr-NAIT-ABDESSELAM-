from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = (
        *UserAdmin.fieldsets,
        (
            "Clinic profile",
            {
                "fields": (
                    "phone",
                    "role",
                    "professional_title",
                    "avatar",
                    "profile_notes",
                )
            },
        ),
    )
    add_fieldsets = (
        *UserAdmin.add_fieldsets,
        (
            "Clinic profile",
            {
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "phone",
                    "role",
                    "professional_title",
                )
            },
        ),
    )
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "role",
        "professional_title",
        "is_active",
        "is_staff",
    )
    list_filter = (*UserAdmin.list_filter, "role")
    search_fields = ("username", "email", "first_name", "last_name", "phone")
