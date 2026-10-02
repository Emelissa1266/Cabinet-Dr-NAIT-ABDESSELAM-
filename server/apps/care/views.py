from django.core.exceptions import ValidationError as DjangoValidationError
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User
from apps.audit.services import record_audit_event

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
from .permissions import (
    CareCatalogPermission,
    CarePermission,
    CareSessionPermission,
    NursingExecutionPermission,
)
from .serializers import (
    CareCategorySerializer,
    CareObservationSerializer,
    CareParameterDefinitionSerializer,
    CareSerializer,
    CareSessionMaterialSerializer,
    CareSessionParameterSerializer,
    CareSessionSerializer,
    CareTypeSerializer,
    ClinicalMeasurementSerializer,
)
from .services import complete_care_session, start_care_session


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


class CareCategoryViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = CareCategory.objects.all()
    serializer_class = CareCategorySerializer
    permission_classes = [CareCatalogPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("is_active",)
    search_fields = ("name", "description")
    ordering_fields = ("name", "created_at")
    ordering = ("name",)
    audit_entity_type = "CareCategory"
    audit_create_action = "CARE_CATEGORY_CREATED"
    audit_update_action = "CARE_CATEGORY_UPDATED"


class CareTypeViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = CareType.objects.select_related("category").all()
    serializer_class = CareTypeSerializer
    permission_classes = [CareCatalogPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("category", "is_active", "requires_vital_signs", "requires_observation")
    search_fields = ("name", "description", "category__name")
    ordering_fields = ("name", "created_at", "default_price")
    ordering = ("category__name", "name")
    audit_entity_type = "CareType"
    audit_create_action = "CARE_TYPE_CREATED"
    audit_update_action = "CARE_TYPE_UPDATED"


class CareViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = (
        Care.objects.select_related(
            "patient",
            "care_type",
            "care_type__category",
            "prescribed_by",
            "assigned_nurse",
            "consultation",
            "medical_instruction",
            "surgery",
        )
        .prefetch_related("sessions")
        .all()
    )
    serializer_class = CareSerializer
    permission_classes = [CarePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "care_type": ["exact"],
        "care_type__category": ["exact"],
        "assigned_nurse": ["exact"],
        "prescribed_by": ["exact"],
        "surgery": ["exact"],
        "status": ["exact"],
        "start_date": ["exact", "gte", "lte"],
    }
    search_fields = ("notes", "patient__first_name", "patient__last_name", "care_type__name")
    ordering_fields = ("start_date", "created_at", "updated_at")
    ordering = ("-start_date", "-created_at")
    audit_entity_type = "Care"
    audit_create_action = "CARE_CREATED"
    audit_update_action = "CARE_UPDATED"

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role == User.Role.NURSE:
            return queryset.filter(assigned_nurse=self.request.user)
        return queryset


class CareSessionViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = CareSession.objects.select_related("care", "care__patient", "care__care_type", "nurse").all()
    serializer_class = CareSessionSerializer
    permission_classes = [CareSessionPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "care": ["exact"],
        "care__patient": ["exact"],
        "nurse": ["exact"],
        "status": ["exact"],
        "scheduled_at": ["date", "gte", "lte"],
    }
    search_fields = ("notes", "care__patient__first_name", "care__patient__last_name")
    ordering_fields = ("scheduled_at", "created_at", "updated_at")
    ordering = ("scheduled_at", "created_at")
    audit_entity_type = "CareSession"
    audit_create_action = "CARE_SESSION_CREATED"
    audit_update_action = "CARE_SESSION_UPDATED"

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role == User.Role.NURSE:
            return queryset.filter(nurse=self.request.user)
        return queryset

    @extend_schema(description="Start a planned care session assigned to the authenticated nurse.")
    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        session = self.get_object()
        try:
            session = start_care_session(session=session, nurse=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(session).data)

    @extend_schema(description="Complete an in-progress care session after required parameters are present.")
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        session = self.get_object()
        try:
            session = complete_care_session(session=session, nurse=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(session).data)


class CareObservationViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = CareObservation.objects.select_related("care_session", "care_session__care", "nurse").all()
    serializer_class = CareObservationSerializer
    permission_classes = [NursingExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "care_session": ["exact"],
        "care_session__care": ["exact"],
        "care_session__care__patient": ["exact"],
        "nurse": ["exact"],
    }
    search_fields = ("observation",)
    ordering_fields = ("created_at",)
    ordering = ("created_at",)
    audit_entity_type = "CareObservation"
    audit_create_action = "CARE_OBSERVATION_CREATED"
    audit_update_action = "CARE_OBSERVATION_UPDATED"

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.role == User.Role.NURSE:
            return queryset.filter(nurse=self.request.user)
        return queryset


class ClinicalMeasurementViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = ClinicalMeasurement.objects.select_related("care_session", "care_session__care", "recorded_by")
    serializer_class = ClinicalMeasurementSerializer
    permission_classes = [NursingExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "care_session": ["exact"],
        "care_session__care__patient": ["exact"],
        "measurement_type": ["exact"],
        "recorded_by": ["exact"],
    }
    search_fields = ("measurement_type", "notes")
    ordering_fields = ("recorded_at", "created_at")
    ordering = ("-recorded_at",)
    audit_entity_type = "ClinicalMeasurement"
    audit_create_action = "CLINICAL_MEASUREMENT_RECORDED"
    audit_update_action = "CLINICAL_MEASUREMENT_UPDATED"


class CareSessionMaterialViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = CareSessionMaterial.objects.select_related("care_session", "care_session__care", "recorded_by")
    serializer_class = CareSessionMaterialSerializer
    permission_classes = [NursingExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("care_session", "recorded_by")
    search_fields = ("name", "notes")
    ordering_fields = ("created_at",)
    ordering = ("created_at",)
    audit_entity_type = "CareSessionMaterial"
    audit_create_action = "CARE_MATERIAL_RECORDED"
    audit_update_action = "CARE_MATERIAL_UPDATED"


class CareParameterDefinitionViewSet(AuditCreateUpdateMixin, viewsets.ModelViewSet):
    queryset = CareParameterDefinition.objects.select_related("care_type").all()
    serializer_class = CareParameterDefinitionSerializer
    permission_classes = [CareCatalogPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("care_type", "required", "active", "data_type")
    search_fields = ("key", "label")
    ordering_fields = ("key", "created_at")
    ordering = ("care_type__name", "key")
    audit_entity_type = "CareParameterDefinition"
    audit_create_action = "CARE_PARAMETER_DEFINITION_CREATED"
    audit_update_action = "CARE_PARAMETER_DEFINITION_UPDATED"


class CareSessionParameterViewSet(viewsets.ModelViewSet):
    queryset = CareSessionParameter.objects.select_related(
        "care_session",
        "care_session__care",
        "parameter_definition",
        "recorded_by",
    )
    serializer_class = CareSessionParameterSerializer
    permission_classes = [NursingExecutionPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("care_session", "parameter_definition", "recorded_by")
    search_fields = ("parameter_definition__key", "value")
    ordering_fields = ("created_at",)
    ordering = ("parameter_definition__key",)
