from django.contrib import admin

from .models import (
    AnesthesiaRecord,
    IntraoperativeEvent,
    PostoperativeAssessment,
    PostoperativeFollowUp,
    PreoperativeAssessment,
    PreoperativeChecklistItem,
    PreoperativeRequirement,
    Surgery,
    SurgeryComplication,
    SurgeryConsent,
    SurgeryOperativeRecord,
    SurgeryPreoperativeChecklist,
    SurgeryTeamMember,
)


@admin.register(Surgery)
class SurgeryAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "procedure_name", "surgeon", "status", "planned_date", "actual_start_at")
    list_filter = ("status", "priority", "surgeon", "planned_date")
    search_fields = ("patient__patient_reference", "patient__first_name", "patient__last_name", "procedure_name")
    ordering = ("-planned_date", "-created_at")


@admin.register(PreoperativeAssessment)
class PreoperativeAssessmentAdmin(admin.ModelAdmin):
    list_display = ("surgery", "assessed_by", "readiness_status", "assessment_date")
    list_filter = ("readiness_status", "fasting_status", "anesthesia_evaluation_status")
    search_fields = ("surgery__procedure_name", "assessment_notes")


@admin.register(PreoperativeChecklistItem)
class PreoperativeChecklistItemAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_required", "is_active", "sort_order")
    list_filter = ("category", "is_required", "is_active")
    search_fields = ("name", "description")
    ordering = ("sort_order", "name")


@admin.register(SurgeryPreoperativeChecklist)
class SurgeryPreoperativeChecklistAdmin(admin.ModelAdmin):
    list_display = ("surgery", "checklist_item", "status", "checked_by", "checked_at")
    list_filter = ("status", "checklist_item")
    search_fields = ("surgery__procedure_name", "checklist_item__name", "notes")


@admin.register(PreoperativeRequirement)
class PreoperativeRequirementAdmin(admin.ModelAdmin):
    list_display = ("surgery", "name", "requirement_type", "required", "status", "reviewed_by")
    list_filter = ("requirement_type", "required", "status")
    search_fields = ("name", "description", "result_summary")


@admin.register(SurgeryConsent)
class SurgeryConsentAdmin(admin.ModelAdmin):
    list_display = ("surgery", "consent_type", "required", "status", "confirmed_by", "confirmed_at")
    list_filter = ("required", "status", "consent_type")
    search_fields = ("surgery__procedure_name", "consent_type", "notes")


@admin.register(AnesthesiaRecord)
class AnesthesiaRecordAdmin(admin.ModelAdmin):
    list_display = ("surgery", "anesthesia_type", "provider_name", "created_at")
    list_filter = ("anesthesia_type",)
    search_fields = ("surgery__procedure_name", "provider_name", "complications")


@admin.register(SurgeryOperativeRecord)
class SurgeryOperativeRecordAdmin(admin.ModelAdmin):
    list_display = ("surgery", "surgeon", "procedure_performed", "actual_start_at", "actual_end_at")
    list_filter = ("surgeon", "anesthesia_type")
    search_fields = ("procedure_performed", "operative_findings", "operative_notes")


@admin.register(SurgeryTeamMember)
class SurgeryTeamMemberAdmin(admin.ModelAdmin):
    list_display = ("surgery", "user", "external_name", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("external_name", "notes", "user__username")


@admin.register(IntraoperativeEvent)
class IntraoperativeEventAdmin(admin.ModelAdmin):
    list_display = ("surgery", "event_type", "severity", "recorded_by", "occurred_at")
    list_filter = ("event_type", "severity", "recorded_by")
    search_fields = ("description",)
    ordering = ("occurred_at",)


@admin.register(SurgeryComplication)
class SurgeryComplicationAdmin(admin.ModelAdmin):
    list_display = ("surgery", "complication_type", "severity", "resolved", "occurred_at")
    list_filter = ("severity", "resolved")
    search_fields = ("complication_type", "description", "action_taken")


@admin.register(PostoperativeAssessment)
class PostoperativeAssessmentAdmin(admin.ModelAdmin):
    list_display = ("surgery", "assessed_by", "assessed_at", "pain_score")
    list_filter = ("assessed_by", "assessed_at")
    search_fields = ("general_condition", "wound_status", "instructions")


@admin.register(PostoperativeFollowUp)
class PostoperativeFollowUpAdmin(admin.ModelAdmin):
    list_display = ("surgery", "patient", "doctor", "follow_up_date", "recovery_status")
    list_filter = ("doctor", "follow_up_date")
    search_fields = ("surgery__procedure_name", "patient__patient_reference", "recovery_status")
