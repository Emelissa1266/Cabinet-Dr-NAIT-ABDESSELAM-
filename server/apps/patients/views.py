from typing import ClassVar

from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services import record_audit_event

from .filters import PatientFilter
from .models import MedicalAlert, Patient
from .permissions import MedicalAlertPermission, PatientPermission
from .serializers import MedicalAlertSerializer, PatientSerializer


@extend_schema_view(
    list=extend_schema(
        description="List patients with role-based access, search, filtering, ordering, and pagination.",
        responses={200: PatientSerializer},
    ),
    create=extend_schema(
        description="Create a patient. Patient references are generated automatically.",
        request=PatientSerializer,
        responses={201: PatientSerializer, 403: None},
    ),
    retrieve=extend_schema(
        description="Retrieve a patient. Restricted clinical information is hidden from secretaries.",
        responses={200: PatientSerializer, 403: None, 404: None},
    ),
    partial_update=extend_schema(
        description="Partially update patient administrative information.",
        request=PatientSerializer,
        responses={200: PatientSerializer, 403: None, 404: None},
    ),
    update=extend_schema(
        description="Update patient administrative information.",
        request=PatientSerializer,
        responses={200: PatientSerializer, 403: None, 404: None},
    ),
    destroy=extend_schema(
        description="Delete a patient. Limited to administrators and doctors.",
        responses={204: None, 403: None, 404: None},
    ),
)
class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.select_related("created_by", "updated_by").all()
    serializer_class = PatientSerializer
    permission_classes: ClassVar[list[type]] = [PatientPermission]
    filterset_class = PatientFilter
    search_fields = (
        "first_name",
        "last_name",
        "patient_reference",
        "phone",
        "email",
    )
    ordering_fields = (
        "patient_reference",
        "first_name",
        "last_name",
        "date_of_birth",
        "city",
        "created_at",
        "updated_at",
    )
    ordering = ("last_name", "first_name")

    def perform_create(self, serializer):
        patient = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_event(
            user=self.request.user,
            action="PATIENT_CREATED",
            entity_type="Patient",
            entity_id=patient.pk,
            new_data=PatientSerializer(patient, context={"request": self.request}).data,
            request=self.request,
        )

    def perform_update(self, serializer):
        old_data = PatientSerializer(
            self.get_object(),
            context={"request": self.request},
        ).data
        patient = serializer.save(updated_by=self.request.user)
        record_audit_event(
            user=self.request.user,
            action="PATIENT_UPDATED",
            entity_type="Patient",
            entity_id=patient.pk,
            old_data=old_data,
            new_data=PatientSerializer(patient, context={"request": self.request}).data,
            request=self.request,
        )

    def perform_destroy(self, instance):
        old_data = PatientSerializer(instance, context={"request": self.request}).data
        record_audit_event(
            user=self.request.user,
            action="PATIENT_DELETED",
            entity_type="Patient",
            entity_id=instance.pk,
            old_data=old_data,
            request=self.request,
        )
        instance.delete()


class MedicalAlertViewSet(viewsets.ModelViewSet):
    serializer_class = MedicalAlertSerializer
    permission_classes = [MedicalAlertPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "category": ["exact"],
        "severity": ["exact"],
        "is_active": ["exact"],
    }
    search_fields = ("title", "description", "patient__first_name", "patient__last_name")
    ordering_fields = ("created_at", "updated_at", "severity", "category")
    ordering = ("-is_active", "-created_at")

    def get_queryset(self):
        return MedicalAlert.objects.select_related("patient", "created_by", "resolved_by").all()

    def perform_create(self, serializer):
        alert = serializer.save(created_by=self.request.user)
        record_audit_event(
            user=self.request.user,
            action="MEDICAL_ALERT_CREATED",
            entity_type="MedicalAlert",
            entity_id=alert.pk,
            new_data=MedicalAlertSerializer(alert, context={"request": self.request}).data,
            request=self.request,
        )

    def perform_update(self, serializer):
        old_data = MedicalAlertSerializer(self.get_object(), context={"request": self.request}).data
        alert = serializer.save()
        record_audit_event(
            user=self.request.user,
            action="MEDICAL_ALERT_UPDATED",
            entity_type="MedicalAlert",
            entity_id=alert.pk,
            old_data=old_data,
            new_data=MedicalAlertSerializer(alert, context={"request": self.request}).data,
            request=self.request,
        )

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        old_data = MedicalAlertSerializer(alert, context={"request": request}).data
        alert.is_active = False
        alert.resolved_by = request.user
        alert.resolved_at = timezone.now()
        alert.resolution_note = str(request.data.get("resolution_note", "")).strip()
        alert.save(update_fields=("is_active", "resolved_by", "resolved_at", "resolution_note", "updated_at"))
        record_audit_event(
            user=request.user,
            action="MEDICAL_ALERT_RESOLVED",
            entity_type="MedicalAlert",
            entity_id=alert.pk,
            old_data=old_data,
            new_data=MedicalAlertSerializer(alert, context={"request": request}).data,
            request=request,
        )
        return Response(self.get_serializer(alert).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Medical alerts are resolved, not deleted."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
