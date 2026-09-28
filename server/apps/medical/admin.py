from django.contrib import admin

from .models import Consultation, MedicalInstruction, Prescription, PrescriptionItem


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 0


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "doctor", "consultation_type", "status", "consultation_date")
    list_filter = ("consultation_type", "status", "doctor", "consultation_date")
    search_fields = ("patient__patient_reference", "patient__first_name", "patient__last_name", "diagnosis")
    ordering = ("-consultation_date",)


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "doctor", "status", "prescribed_at")
    list_filter = ("status", "doctor", "prescribed_at")
    search_fields = ("patient__patient_reference", "patient__first_name", "patient__last_name", "items__medication_name")
    ordering = ("-prescribed_at",)
    inlines = (PrescriptionItemInline,)


@admin.register(MedicalInstruction)
class MedicalInstructionAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "doctor", "title", "priority", "status", "created_at")
    list_filter = ("priority", "status", "doctor", "created_at")
    search_fields = ("patient__patient_reference", "patient__first_name", "patient__last_name", "title", "instruction")
    ordering = ("-created_at",)
