from django.core.exceptions import ValidationError as DjangoValidationError
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services import record_audit_event

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
from .permissions import (
    DoctorOnlySurgeryPermission,
    PreoperativeExecutionPermission,
    SurgeryPermission,
)
from .serializers import (
    AnesthesiaRecordSerializer,
    IntraoperativeEventSerializer,
    PostoperativeAssessmentSerializer,
    PostoperativeFollowUpSerializer,
    PreoperativeAssessmentSerializer,
    PreoperativeChecklistItemSerializer,
    PreoperativeRequirementSerializer,
    SurgeryCancelSerializer,
    SurgeryComplicationSerializer,
    SurgeryConsentSerializer,
    SurgeryOperativeRecordSerializer,
    SurgeryPreoperativeChecklistSerializer,
    SurgerySerializer,
    SurgeryTeamMemberSerializer,
)
from .services import (
    begin_preop,
    cancel_surgery,
    complete_surgery,
    mark_ready,
    plan_surgery,
    start_surgery,
)


def drf_validation(error):
    if hasattr(error, "message_dict"):
        return error.message_dict
    return {"detail": error.messages}


class AuditCreateUpdateMixin:
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
        record_audit_event(
            user=self.request.user,
            action=self.audit_update_action,
            entity_type=self.audit_entity_type,
            entity_id=instance.pk,
            old_data=old_data,
            new_data=self.get_serializer(instance).data,
            request=self.request,
        )


class SurgeryViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = Surgery.objects.select_related("patient", "consultation", "surgeon").prefetch_related(
        "preop_checklists",
        "preop_requirements",
        "consents",
        "complications",
        "follow_ups",
    )
    serializer_class = SurgerySerializer
    permission_classes = [SurgeryPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "surgeon": ["exact"],
        "status": ["exact"],
        "procedure_name": ["icontains"],
        "planned_date": ["date", "gte", "lte"],
        "actual_start_at": ["date", "gte", "lte"],
    }
    search_fields = (
        "patient__patient_reference",
        "patient__first_name",
        "patient__last_name",
        "procedure_name",
        "anatomical_site",
    )
    ordering_fields = ("planned_date", "actual_start_at", "created_at", "updated_at")
    ordering = ("-planned_date", "-created_at")
    audit_entity_type = "Surgery"
    audit_create_action = "SURGERY_CREATED"
    audit_update_action = "SURGERY_PLAN_UPDATED"

    @extend_schema(description="Transition surgery from DRAFT to PLANNED.")
    @action(detail=True, methods=["post"], permission_classes=[DoctorOnlySurgeryPermission])
    def plan(self, request, pk=None):
        try:
            surgery = plan_surgery(surgery=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(surgery).data)

    @extend_schema(description="Transition surgery from PLANNED to PREOP_IN_PROGRESS.")
    @action(detail=True, methods=["post"], url_path="begin-preop", permission_classes=[DoctorOnlySurgeryPermission])
    def begin_preop(self, request, pk=None):
        try:
            surgery = begin_preop(surgery=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(surgery).data)

    @extend_schema(description="Validate readiness and transition surgery to READY.")
    @action(detail=True, methods=["post"], url_path="mark-ready", permission_classes=[DoctorOnlySurgeryPermission])
    def mark_ready(self, request, pk=None):
        try:
            surgery = mark_ready(surgery=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(surgery).data)

    @extend_schema(description="Start a READY surgery.")
    @action(detail=True, methods=["post"], permission_classes=[DoctorOnlySurgeryPermission])
    def start(self, request, pk=None):
        try:
            surgery = start_surgery(surgery=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(surgery).data)

    @extend_schema(description="Complete an IN_PROGRESS surgery with an operative record.")
    @action(detail=True, methods=["post"], permission_classes=[DoctorOnlySurgeryPermission])
    def complete(self, request, pk=None):
        try:
            surgery = complete_surgery(surgery=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(surgery).data)

    @extend_schema(description="Cancel an uncompleted surgery.", request=SurgeryCancelSerializer)
    @action(detail=True, methods=["post"], permission_classes=[DoctorOnlySurgeryPermission])
    def cancel(self, request, pk=None):
        serializer = SurgeryCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            surgery = cancel_surgery(
                surgery=self.get_object(),
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request=request,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(surgery).data)


class PreoperativeAssessmentViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = PreoperativeAssessment.objects.select_related("surgery", "assessed_by")
    serializer_class = PreoperativeAssessmentSerializer
    permission_classes = [PreoperativeExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("surgery", "readiness_status", "fasting_status", "anesthesia_evaluation_status")
    ordering_fields = ("assessment_date", "created_at")
    ordering = ("-assessment_date",)
    audit_entity_type = "PreoperativeAssessment"
    audit_create_action = "PREOP_ASSESSMENT_UPDATED"
    audit_update_action = "PREOP_ASSESSMENT_UPDATED"


class PreoperativeChecklistItemViewSet(viewsets.ModelViewSet):
    queryset = PreoperativeChecklistItem.objects.all()
    serializer_class = PreoperativeChecklistItemSerializer
    permission_classes = [SurgeryPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("category", "is_required", "is_active")
    search_fields = ("name", "description", "category")
    ordering_fields = ("sort_order", "name", "created_at")
    ordering = ("sort_order", "name")


class SurgeryPreoperativeChecklistViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = SurgeryPreoperativeChecklist.objects.select_related("surgery", "checklist_item", "checked_by")
    serializer_class = SurgeryPreoperativeChecklistSerializer
    permission_classes = [PreoperativeExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("surgery", "checklist_item", "status")
    ordering_fields = ("checked_at",)
    ordering = ("checklist_item__sort_order",)
    audit_entity_type = "SurgeryPreoperativeChecklist"
    audit_create_action = "PREOP_CHECKLIST_UPDATED"
    audit_update_action = "PREOP_CHECKLIST_UPDATED"


class PreoperativeRequirementViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = PreoperativeRequirement.objects.select_related("surgery", "reviewed_by")
    serializer_class = PreoperativeRequirementSerializer
    permission_classes = [PreoperativeExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("surgery", "requirement_type", "required", "status")
    search_fields = ("name", "description", "result_summary")
    ordering_fields = ("created_at", "reviewed_at")
    ordering = ("created_at",)
    audit_entity_type = "PreoperativeRequirement"
    audit_create_action = "PREOP_REQUIREMENT_UPDATED"
    audit_update_action = "PREOP_REQUIREMENT_UPDATED"


class SurgeryConsentViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = SurgeryConsent.objects.select_related("surgery", "confirmed_by")
    serializer_class = SurgeryConsentSerializer
    permission_classes = [PreoperativeExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("surgery", "status", "required", "consent_type")
    ordering = ("consent_type",)
    audit_entity_type = "SurgeryConsent"
    audit_create_action = "SURGERY_CONSENT_UPDATED"
    audit_update_action = "SURGERY_CONSENT_UPDATED"


class AnesthesiaRecordViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = AnesthesiaRecord.objects.select_related("surgery")
    serializer_class = AnesthesiaRecordSerializer
    permission_classes = [SurgeryPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ("surgery", "anesthesia_type")
    search_fields = ("provider_name", "pre_anesthesia_notes", "complications")
    audit_entity_type = "AnesthesiaRecord"
    audit_create_action = "ANESTHESIA_RECORD_CREATED"
    audit_update_action = "ANESTHESIA_RECORD_UPDATED"


class SurgeryOperativeRecordViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = SurgeryOperativeRecord.objects.select_related("surgery", "surgeon")
    serializer_class = SurgeryOperativeRecordSerializer
    permission_classes = [SurgeryPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ("surgery", "surgeon", "anesthesia_type")
    search_fields = ("procedure_performed", "operative_findings", "operative_notes")
    audit_entity_type = "SurgeryOperativeRecord"
    audit_create_action = "OPERATIVE_RECORD_CREATED"
    audit_update_action = "OPERATIVE_RECORD_UPDATED"


class SurgeryTeamMemberViewSet(viewsets.ModelViewSet):
    queryset = SurgeryTeamMember.objects.select_related("surgery", "user")
    serializer_class = SurgeryTeamMemberSerializer
    permission_classes = [SurgeryPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("surgery", "role", "user")
    search_fields = ("external_name", "notes")
    ordering = ("created_at",)


class IntraoperativeEventViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = IntraoperativeEvent.objects.select_related("surgery", "recorded_by")
    serializer_class = IntraoperativeEventSerializer
    permission_classes = [PreoperativeExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("surgery", "recorded_by", "event_type", "severity")
    search_fields = ("description",)
    ordering_fields = ("occurred_at", "created_at")
    ordering = ("occurred_at",)
    audit_entity_type = "IntraoperativeEvent"
    audit_create_action = "INTRAOPERATIVE_EVENT_RECORDED"
    audit_update_action = "INTRAOPERATIVE_EVENT_UPDATED"


class SurgeryComplicationViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = SurgeryComplication.objects.select_related("surgery", "identified_by")
    serializer_class = SurgeryComplicationSerializer
    permission_classes = [PreoperativeExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("surgery", "severity", "resolved")
    search_fields = ("complication_type", "description", "action_taken")
    ordering_fields = ("occurred_at", "created_at")
    ordering = ("occurred_at",)
    audit_entity_type = "SurgeryComplication"
    audit_create_action = "SURGERY_COMPLICATION_RECORDED"
    audit_update_action = "SURGERY_COMPLICATION_UPDATED"


class PostoperativeAssessmentViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = PostoperativeAssessment.objects.select_related("surgery", "assessed_by")
    serializer_class = PostoperativeAssessmentSerializer
    permission_classes = [SurgeryPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("surgery", "assessed_by")
    search_fields = ("general_condition", "wound_status", "instructions")
    ordering_fields = ("assessed_at", "created_at")
    ordering = ("-assessed_at",)
    audit_entity_type = "PostoperativeAssessment"
    audit_create_action = "POSTOP_ASSESSMENT_CREATED"
    audit_update_action = "POSTOP_ASSESSMENT_UPDATED"


class PostoperativeFollowUpViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = PostoperativeFollowUp.objects.select_related("surgery", "patient", "doctor")
    serializer_class = PostoperativeFollowUpSerializer
    permission_classes = [SurgeryPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "surgery": ["exact"],
        "patient": ["exact"],
        "doctor": ["exact"],
        "follow_up_date": ["date", "gte", "lte"],
    }
    search_fields = ("recovery_status", "wound_assessment", "clinical_findings", "recommendations")
    ordering_fields = ("follow_up_date", "created_at")
    ordering = ("-follow_up_date",)
    audit_entity_type = "PostoperativeFollowUp"
    audit_create_action = "POSTOP_FOLLOWUP_CREATED"
    audit_update_action = "POSTOP_FOLLOWUP_UPDATED"
