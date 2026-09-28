from django.contrib import admin

from .models import (
    Patient,
    PatientAllergy,
    PatientChronicCondition,
    PatientClinicalNote,
    PatientContraindication,
    PatientMedicalHistory,
    PatientMedication,
    PatientSurgicalHistory,
)


class PatientMedicalInline(admin.TabularInline):
    extra = 0
    fields = ("title", "description", "is_active", "recorded_by", "created_at")
    readonly_fields = ("created_at",)


class PatientAllergyInline(PatientMedicalInline):
    model = PatientAllergy
    fields = (*PatientMedicalInline.fields, "severity")


class PatientMedicalHistoryInline(PatientMedicalInline):
    model = PatientMedicalHistory


class PatientSurgicalHistoryInline(PatientMedicalInline):
    model = PatientSurgicalHistory
    fields = (*PatientMedicalInline.fields, "surgery_date")


class PatientChronicConditionInline(PatientMedicalInline):
    model = PatientChronicCondition
    fields = (*PatientMedicalInline.fields, "diagnosed_at")


class PatientMedicationInline(PatientMedicalInline):
    model = PatientMedication
    fields = (*PatientMedicalInline.fields, "dosage", "frequency")


class PatientContraindicationInline(PatientMedicalInline):
    model = PatientContraindication


class PatientClinicalNoteInline(admin.TabularInline):
    model = PatientClinicalNote
    extra = 0
    fields = ("note", "recorded_by", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
        "patient_reference",
        "first_name",
        "last_name",
        "phone",
        "city",
        "is_active",
        "created_at",
    )
    list_filter = ("gender", "is_active", "city", "created_at")
    search_fields = ("patient_reference", "first_name", "last_name", "phone", "email")
    readonly_fields = ("patient_reference", "created_at", "updated_at")
    inlines = (
        PatientAllergyInline,
        PatientMedicalHistoryInline,
        PatientSurgicalHistoryInline,
        PatientChronicConditionInline,
        PatientMedicationInline,
        PatientContraindicationInline,
        PatientClinicalNoteInline,
    )


admin.site.register(PatientAllergy)
admin.site.register(PatientMedicalHistory)
admin.site.register(PatientSurgicalHistory)
admin.site.register(PatientChronicCondition)
admin.site.register(PatientMedication)
admin.site.register(PatientContraindication)
admin.site.register(PatientClinicalNote)
