from typing import ClassVar

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets

from apps.audit.services import record_audit_event

from .filters import PatientFilter
from .models import Patient
from .permissions import PatientPermission
from .serializers import PatientSerializer


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
