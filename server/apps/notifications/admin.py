from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "notification_type", "priority", "title", "is_read", "created_at")
    list_filter = ("notification_type", "priority", "is_read", "created_at")
    search_fields = ("recipient__first_name", "recipient__last_name", "recipient__email", "title")
    readonly_fields = ("deduplication_key", "created_at", "updated_at")
