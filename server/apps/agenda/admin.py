from django.contrib import admin

from .models import (
    Appointment,
    AppointmentReschedule,
    AppointmentStaff,
    AppointmentType,
    ClinicClosure,
    StaffTimeOff,
    StaffWorkingHours,
)


class AppointmentStaffInline(admin.TabularInline):
    model = AppointmentStaff
    extra = 0


@admin.register(AppointmentType)
class AppointmentTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "category", "default_duration_minutes", "is_active")
    list_filter = ("category", "is_active", "requires_doctor", "requires_nurse")
    search_fields = ("name", "code", "description")
    ordering = ("name",)


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "appointment_type", "primary_staff", "start_at", "end_at", "status")
    list_filter = ("status", "appointment_type", "primary_staff", "start_at")
    search_fields = ("patient__patient_reference", "patient__first_name", "patient__last_name", "reason")
    ordering = ("start_at",)
    inlines = (AppointmentStaffInline,)


@admin.register(AppointmentStaff)
class AppointmentStaffAdmin(admin.ModelAdmin):
    list_display = ("appointment", "user", "role", "is_required", "created_at")
    list_filter = ("role", "is_required")
    search_fields = ("appointment__patient__patient_reference", "user__username", "notes")


@admin.register(StaffWorkingHours)
class StaffWorkingHoursAdmin(admin.ModelAdmin):
    list_display = ("staff", "weekday", "start_time", "end_time", "is_active")
    list_filter = ("weekday", "is_active", "staff")
    ordering = ("staff", "weekday", "start_time")


@admin.register(StaffTimeOff)
class StaffTimeOffAdmin(admin.ModelAdmin):
    list_display = ("staff", "start_at", "end_at", "reason", "created_by")
    list_filter = ("reason", "staff", "start_at")
    search_fields = ("staff__username", "notes")


@admin.register(ClinicClosure)
class ClinicClosureAdmin(admin.ModelAdmin):
    list_display = ("start_at", "end_at", "reason", "created_by")
    list_filter = ("start_at",)
    search_fields = ("reason", "notes")


@admin.register(AppointmentReschedule)
class AppointmentRescheduleAdmin(admin.ModelAdmin):
    list_display = ("appointment", "old_start_at", "new_start_at", "changed_by", "changed_at")
    list_filter = ("changed_by", "changed_at")
    search_fields = ("appointment__patient__patient_reference", "reason")
