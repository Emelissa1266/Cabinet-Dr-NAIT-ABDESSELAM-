from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "role", "action", "entity_type", "entity_id")
    list_filter = ("role", "action", "entity_type", "created_at")
    search_fields = ("action", "entity_type", "entity_id", "user__username", "user__email")
    readonly_fields = (
        "user",
        "role",
        "action",
        "entity_type",
        "entity_id",
        "old_data",
        "new_data",
        "ip_address",
        "created_at",
    )
