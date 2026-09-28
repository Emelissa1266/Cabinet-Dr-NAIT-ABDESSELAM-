from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, viewsets

from apps.audit.services import record_audit_event

from .models import Consultation, MedicalInstruction, Prescription
from .permissions import MedicalReadDoctorWritePermission
from .serializers import (
    ConsultationSerializer,
    MedicalInstructionSerializer,
    PrescriptionSerializer,
)


class AuditMixin:
    audit_entity_type = ""
    audit_create_action = ""
    audit_update_action = ""

    def perform_create(self, serializer):
        instance = serializer.save()
        record_audit_event(
            user=self.request.user,
            action=self.audit_create_action,
            entity_type=self.audit_entity_type,
            entity_id=instance.pk,
            new_data=self.get_serializer(instance).data,
            request=self.request,
        )

    def perform_update(self, serializer):
        old_data = self.get_serializer(self.get_object()).data
        instance = serializer.save()
        action = self.audit_update_action
        if self.audit_entity_type == "Consultation" and instance.status == Consultation.Status.COMPLETED:
            action = "CONSULTATION_COMPLETED"
        record_audit_event(
            user=self.request.user,
            action=action,
            entity_type=self.audit_entity_type,
            entity_id=instance.pk,
            old_data=old_data,
            new_data=self.get_serializer(instance).data,
            request=self.request,
        )


@extend_schema_view(
    list=extend_schema(description="List consultations with medical RBAC and filters."),
    create=extend_schema(description="Doctor creates a patient consultation and clinical decision data."),
    retrieve=extend_schema(description="Retrieve a consultation."),
    update=extend_schema(description="Doctor updates a consultation."),
    partial_update=extend_schema(description="Doctor partially updates a consultation."),
)
class ConsultationViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = Consultation.objects.select_related("patient", "doctor").all()
    serializer_class = ConsultationSerializer
    permission_classes = [MedicalReadDoctorWritePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "doctor": ["exact"],
        "status": ["exact"],
        "consultation_type": ["exact"],
        "consultation_date": ["date", "gte", "lte"],
    }
    search_fields = ("reason", "patient_complaint", "clinical_findings", "diagnosis")
    ordering_fields = ("consultation_date", "created_at")
    ordering = ("-consultation_date", "-created_at")
    audit_entity_type = "Consultation"
    audit_create_action = "CONSULTATION_CREATED"
    audit_update_action = "CONSULTATION_UPDATED"


@extend_schema_view(
    list=extend_schema(description="List prescriptions. Nurses may read, doctors may modify."),
    create=extend_schema(description="Doctor creates a structured prescription with items."),
    retrieve=extend_schema(description="Retrieve a prescription and its items."),
    update=extend_schema(description="Doctor updates prescription content."),
    partial_update=extend_schema(description="Doctor partially updates prescription content."),
)
class PrescriptionViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = Prescription.objects.select_related("patient", "doctor", "consultation").prefetch_related("items")
    serializer_class = PrescriptionSerializer
    permission_classes = [MedicalReadDoctorWritePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "doctor": ["exact"],
        "status": ["exact"],
        "surgery": ["exact"],
        "prescribed_at": ["date", "gte", "lte"],
    }
    search_fields = ("general_instructions", "notes", "items__medication_name")
    ordering_fields = ("prescribed_at", "created_at")
    ordering = ("-prescribed_at", "-created_at")
    audit_entity_type = "Prescription"
    audit_create_action = "PRESCRIPTION_CREATED"
    audit_update_action = "PRESCRIPTION_UPDATED"


@extend_schema_view(
    list=extend_schema(description="List doctor-authored medical instructions."),
    create=extend_schema(description="Doctor creates an instruction nurses must follow."),
    retrieve=extend_schema(description="Retrieve a medical instruction."),
    update=extend_schema(description="Doctor updates a medical instruction."),
    partial_update=extend_schema(description="Doctor partially updates a medical instruction."),
)
class MedicalInstructionViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = MedicalInstruction.objects.select_related("patient", "doctor", "consultation").all()
    serializer_class = MedicalInstructionSerializer
    permission_classes = [MedicalReadDoctorWritePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "doctor": ["exact"],
        "status": ["exact"],
        "priority": ["exact"],
        "surgery": ["exact"],
    }
    search_fields = ("title", "instruction")
    ordering_fields = ("created_at", "priority")
    ordering = ("-created_at",)
    audit_entity_type = "MedicalInstruction"
    audit_create_action = "MEDICAL_INSTRUCTION_CREATED"
    audit_update_action = "MEDICAL_INSTRUCTION_UPDATED"
