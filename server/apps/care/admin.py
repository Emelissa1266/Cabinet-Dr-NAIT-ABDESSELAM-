from django.contrib import admin

from .models import (
    Care,
    CareCategory,
    CareObservation,
    CareParameterDefinition,
    CareSession,
    CareSessionMaterial,
    CareSessionParameter,
    CareType,
    ClinicalMeasurement,
)


@admin.register(CareCategory)
class CareCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    ordering = ("name",)


@admin.register(CareType)
class CareTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "default_duration_minutes", "default_price", "is_active")
    list_filter = ("category", "is_active", "requires_vital_signs", "requires_observation")
    search_fields = ("name", "description", "category__name")
    ordering = ("category__name", "name")


@admin.register(Care)
class CareAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "care_type", "prescribed_by", "assigned_nurse", "status", "start_date")
    list_filter = ("status", "care_type", "assigned_nurse", "prescribed_by", "start_date")
    search_fields = ("patient__patient_reference", "patient__first_name", "patient__last_name", "care_type__name")
    ordering = ("-start_date", "-created_at")


@admin.register(CareSession)
class CareSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "care", "nurse", "status", "scheduled_at", "started_at", "completed_at")
    list_filter = ("status", "nurse", "scheduled_at")
    search_fields = ("care__patient__patient_reference", "care__patient__first_name", "care__patient__last_name")
    ordering = ("scheduled_at", "created_at")


@admin.register(CareObservation)
class CareObservationAdmin(admin.ModelAdmin):
    list_display = ("id", "care_session", "nurse", "created_at")
    list_filter = ("nurse", "created_at")
    search_fields = ("observation", "care_session__care__patient__patient_reference")
    ordering = ("created_at",)


@admin.register(ClinicalMeasurement)
class ClinicalMeasurementAdmin(admin.ModelAdmin):
    list_display = ("id", "care_session", "measurement_type", "value", "unit", "recorded_by", "recorded_at")
    list_filter = ("measurement_type", "recorded_by", "recorded_at")
    search_fields = ("value", "notes", "care_session__care__patient__patient_reference")
    ordering = ("-recorded_at",)


@admin.register(CareSessionMaterial)
class CareSessionMaterialAdmin(admin.ModelAdmin):
    list_display = ("id", "care_session", "name", "quantity", "unit", "recorded_by", "created_at")
    list_filter = ("recorded_by", "created_at")
    search_fields = ("name", "notes", "care_session__care__patient__patient_reference")
    ordering = ("created_at",)


@admin.register(CareParameterDefinition)
class CareParameterDefinitionAdmin(admin.ModelAdmin):
    list_display = ("care_type", "key", "label", "data_type", "required", "active")
    list_filter = ("care_type", "data_type", "required", "active")
    search_fields = ("key", "label", "care_type__name")
    ordering = ("care_type__name", "key")


@admin.register(CareSessionParameter)
class CareSessionParameterAdmin(admin.ModelAdmin):
    list_display = ("care_session", "parameter_definition", "value", "recorded_by", "created_at")
    list_filter = ("parameter_definition", "recorded_by", "created_at")
    search_fields = ("value", "parameter_definition__key")
    ordering = ("parameter_definition__key",)
