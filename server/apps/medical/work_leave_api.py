from copy import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import HttpResponse
from django.utils.http import content_disposition_header
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from apps.accounts.models import User
from apps.audit.services import record_audit_event

from .models import Consultation, WorkLeave
from .work_leave_services import change_leave, create_leave, history


class WorkLeavePermission(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role == User.Role.DOCTOR
        )

    def has_object_permission(self, request, view, obj):
        return obj.doctor_id == request.user.pk


class WorkLeaveSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    patient_birth_date = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    previous_reference = serializers.CharField(
        source="previous_leave.certificate_number", read_only=True, default=""
    )
    previous_start_date = serializers.DateField(
        source="previous_leave.start_date", read_only=True, default=None
    )
    previous_end_date = serializers.DateField(
        source="previous_leave.end_date", read_only=True, default=None
    )
    writable = {
        "patient",
        "consultation",
        "leave_type",
        "previous_leave",
        "issued_date",
        "start_date",
        "end_date",
        "medical_reason",
        "internal_notes",
        "patient_instructions",
    }

    class Meta:
        model = WorkLeave
        fields = (
            "id",
            "patient",
            "patient_name",
            "patient_birth_date",
            "consultation",
            "doctor",
            "doctor_name",
            "certificate_number",
            "leave_type",
            "previous_leave",
            "previous_reference",
            "previous_start_date",
            "previous_end_date",
            "issued_date",
            "start_date",
            "end_date",
            "duration_days",
            "medical_reason",
            "internal_notes",
            "patient_instructions",
            "status",
            "issued_at",
            "cancelled_at",
            "cancellation_reason",
            "created_at",
            "updated_at",
            "created_by",
            "history",
        )
        read_only_fields = (
            "doctor",
            "certificate_number",
            "duration_days",
            "status",
            "issued_at",
            "cancelled_at",
            "cancellation_reason",
            "created_at",
            "updated_at",
            "created_by",
        )

    def get_patient_name(self, obj):
        return obj.patient_name_snapshot or f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_patient_birth_date(self, obj):
        return (
            obj.patient_birth_date_snapshot
            if obj.status != WorkLeave.Status.DRAFT
            else obj.patient.date_of_birth
        )

    def get_doctor_name(self, obj):
        return obj.doctor_name_snapshot or str(obj.doctor)

    def get_history(self, obj):
        return [{"action": event.action, "created_at": event.created_at} for event in history(obj)]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        actor = getattr(self.context.get("request"), "user", None)
        self.fields["previous_leave"].queryset = WorkLeave.objects.filter(
            doctor_id=getattr(actor, "pk", None), status=WorkLeave.Status.ISSUED
        )
        self.fields["consultation"].queryset = Consultation.objects.filter(
            doctor_id=getattr(actor, "pk", None)
        )

    def to_internal_value(self, data):
        unexpected = set(data) - self.writable
        if unexpected:
            raise serializers.ValidationError(
                {field: "Ce champ n'est pas modifiable." for field in unexpected}
            )
        return super().to_internal_value(data)

    def validate(self, attrs):
        candidate = (
            copy(self.instance) if self.instance else WorkLeave(doctor=self.context["request"].user)
        )
        if self.instance and self.instance.status != WorkLeave.Status.DRAFT:
            raise serializers.ValidationError("Un arrêt émis ou annulé ne peut pas être modifié.")
        for field, value in attrs.items():
            setattr(candidate, field, value)
        try:
            candidate.clean()
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                error.message_dict if hasattr(error, "message_dict") else error.messages
            ) from error
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        return create_leave(actor=request.user, data=validated_data, request=request)

    def update(self, instance, validated_data):
        request = self.context["request"]
        return change_leave(
            pk=instance.pk,
            actor=request.user,
            action="update",
            data=validated_data,
            request=request,
        )


class CancellationSerializer(serializers.Serializer):
    cancellation_reason = serializers.CharField(max_length=5000, allow_blank=False)


class WorkLeaveViewSet(viewsets.ModelViewSet):
    serializer_class = WorkLeaveSerializer
    permission_classes = [WorkLeavePermission]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("patient", "consultation", "status", "leave_type")
    search_fields = ("certificate_number", "patient__first_name", "patient__last_name")
    ordering_fields = ("issued_date", "start_date", "created_at")
    ordering = ("-issued_date", "-id")

    def get_queryset(self):
        if not self.request.user.is_authenticated or self.request.user.role != User.Role.DOCTOR:
            return WorkLeave.objects.none()
        return WorkLeave.objects.filter(doctor=self.request.user).select_related(
            "patient", "doctor", "previous_leave", "consultation"
        )

    def handle_exception(self, exc):
        if isinstance(exc, DjangoValidationError):
            exc = serializers.ValidationError(
                exc.message_dict if hasattr(exc, "message_dict") else exc.messages
            )
        return super().handle_exception(exc)

    def destroy(self, request, *args, **kwargs):
        leave = self.get_object()
        change_leave(pk=leave.pk, actor=request.user, action="delete", request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        leave = self.get_object()
        if request.data:
            raise serializers.ValidationError("L'émission ne modifie pas le contenu du brouillon.")
        result = change_leave(pk=leave.pk, actor=request.user, action="issue", request=request)
        return Response(self.get_serializer(result).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        leave = self.get_object()
        payload = CancellationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = change_leave(
            pk=leave.pk,
            actor=request.user,
            action="cancel",
            data=payload.validated_data,
            request=request,
        )
        return Response(self.get_serializer(result).data)

    def pdf_response(self, inline):
        from .work_leave_pdf import render_work_leave_pdf

        leave = self.get_object()
        response = HttpResponse(render_work_leave_pdf(leave), content_type="application/pdf")
        response["Content-Disposition"] = content_disposition_header(
            not inline, f"Arret_Travail_{leave.certificate_number}.pdf"
        )
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["X-Content-Type-Options"] = "nosniff"
        record_audit_event(
            user=self.request.user,
            action="WORK_LEAVE_PDF_VIEWED" if inline else "WORK_LEAVE_PDF_DOWNLOADED",
            entity_type="WorkLeave",
            entity_id=leave.pk,
            request=self.request,
        )
        return response

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        return self.pdf_response(False)

    @action(detail=True, methods=["get"], url_path="print")
    def print_pdf(self, request, pk=None):
        return self.pdf_response(True)
