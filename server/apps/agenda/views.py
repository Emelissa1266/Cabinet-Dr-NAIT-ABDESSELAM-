from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.audit.services import record_audit_event

from .models import (
    Appointment,
    AppointmentReschedule,
    AppointmentStaff,
    AppointmentType,
    ClinicClosure,
    StaffTimeOff,
    StaffWorkingHours,
)
from .permissions import AgendaConfigPermission, AgendaPermission
from .serializers import (
    AgendaStaffSerializer,
    AppointmentRescheduleSerializer,
    AppointmentSerializer,
    AppointmentStaffSerializer,
    AppointmentTypeSerializer,
    AvailabilitySlotSerializer,
    CancelAppointmentSerializer,
    ClinicClosureSerializer,
    RescheduleAppointmentSerializer,
    StaffTimeOffSerializer,
    StaffWorkingHoursSerializer,
)
from .services import (
    cancel_appointment,
    check_in_appointment,
    complete_appointment,
    confirm_appointment,
    find_available_slots,
    no_show_appointment,
    reschedule_appointment,
    start_appointment,
)


def drf_validation(error):
    if hasattr(error, "message_dict"):
        return error.message_dict
    return {"detail": error.messages}


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
        record_audit_event(
            user=self.request.user,
            action=self.audit_update_action,
            entity_type=self.audit_entity_type,
            entity_id=instance.pk,
            old_data=old_data,
            new_data=self.get_serializer(instance).data,
            request=self.request,
        )


class AppointmentTypeViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = AppointmentType.objects.all()
    serializer_class = AppointmentTypeSerializer
    permission_classes = [AgendaConfigPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("category", "is_active", "requires_doctor", "requires_nurse")
    search_fields = ("name", "code", "description")
    ordering_fields = ("name", "created_at")
    ordering = ("name",)
    audit_entity_type = "AppointmentType"
    audit_create_action = "APPOINTMENT_TYPE_CREATED"
    audit_update_action = "APPOINTMENT_TYPE_UPDATED"


class AgendaStaffView(APIView):
    permission_classes = [AgendaPermission]

    @extend_schema(responses=AgendaStaffSerializer(many=True))
    def get(self, request):
        queryset = User.objects.filter(is_active=True).order_by("role", "last_name", "first_name", "username")
        return Response(AgendaStaffSerializer(queryset, many=True).data)


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related(
        "patient",
        "appointment_type",
        "primary_staff",
        "consultation",
        "surgery",
        "care_session",
    ).prefetch_related("staff_members", "staff_members__user")
    serializer_class = AppointmentSerializer
    permission_classes = [AgendaPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "appointment_type": ["exact"],
        "appointment_type__category": ["exact"],
        "primary_staff": ["exact"],
        "status": ["exact"],
        "start_at": ["date", "gte", "lte"],
        "consultation": ["exact"],
        "surgery": ["exact"],
        "care_session": ["exact"],
    }
    search_fields = ("patient__patient_reference", "patient__first_name", "patient__last_name", "reason")
    ordering_fields = ("start_at", "end_at", "created_at", "updated_at")
    ordering = ("start_at",)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        return self._transition(confirm_appointment)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        return self._transition(check_in_appointment)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._transition(start_appointment)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._transition(complete_appointment)

    @extend_schema(request=CancelAppointmentSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = CancelAppointmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._transition(cancel_appointment, reason=serializer.validated_data["reason"])

    @action(detail=True, methods=["post"], url_path="no-show")
    def no_show(self, request, pk=None):
        return self._transition(no_show_appointment)

    @extend_schema(request=RescheduleAppointmentSerializer)
    @action(detail=True, methods=["post"])
    def reschedule(self, request, pk=None):
        serializer = RescheduleAppointmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            appointment = reschedule_appointment(
                appointment=self.get_object(),
                actor=request.user,
                request=request,
                **serializer.validated_data,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(appointment).data)

    def _transition(self, service, **kwargs):
        try:
            appointment = service(
                appointment=self.get_object(),
                actor=self.request.user,
                request=self.request,
                **kwargs,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(appointment).data)


class AppointmentStaffViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = AppointmentStaff.objects.select_related("appointment", "user")
    serializer_class = AppointmentStaffSerializer
    permission_classes = [AgendaPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("appointment", "user", "role", "is_required")
    ordering = ("created_at",)
    audit_entity_type = "AppointmentStaff"
    audit_create_action = "APPOINTMENT_STAFF_CHANGED"
    audit_update_action = "APPOINTMENT_STAFF_CHANGED"


class StaffWorkingHoursViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = StaffWorkingHours.objects.select_related("staff")
    serializer_class = StaffWorkingHoursSerializer
    permission_classes = [AgendaConfigPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("staff", "weekday", "is_active")
    ordering = ("staff", "weekday", "start_time")
    audit_entity_type = "StaffWorkingHours"
    audit_create_action = "WORKING_HOURS_CHANGED"
    audit_update_action = "WORKING_HOURS_CHANGED"


class StaffTimeOffViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = StaffTimeOff.objects.select_related("staff", "created_by")
    serializer_class = StaffTimeOffSerializer
    permission_classes = [AgendaConfigPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("staff", "reason")
    ordering = ("start_at",)
    audit_entity_type = "StaffTimeOff"
    audit_create_action = "TIME_OFF_CHANGED"
    audit_update_action = "TIME_OFF_CHANGED"


class ClinicClosureViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = ClinicClosure.objects.select_related("created_by")
    serializer_class = ClinicClosureSerializer
    permission_classes = [AgendaConfigPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering = ("start_at",)
    audit_entity_type = "ClinicClosure"
    audit_create_action = "CLINIC_CLOSURE_CHANGED"
    audit_update_action = "CLINIC_CLOSURE_CHANGED"


class AppointmentRescheduleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AppointmentReschedule.objects.select_related("appointment", "changed_by")
    serializer_class = AppointmentRescheduleSerializer
    permission_classes = [AgendaPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("appointment", "changed_by")
    ordering = ("-changed_at",)


class AvailabilityView(APIView):
    permission_classes = [AgendaPermission]

    @extend_schema(
        parameters=[
            OpenApiParameter("staff", int),
            OpenApiParameter("appointment_type", int),
            OpenApiParameter("date", str),
            OpenApiParameter("date_from", str),
            OpenApiParameter("date_to", str),
            OpenApiParameter("duration_minutes", int),
        ],
        responses=AvailabilitySlotSerializer(many=True),
    )
    def get(self, request):
        staff_id = request.query_params.get("staff")
        appointment_type_id = request.query_params.get("appointment_type")
        if not staff_id or not appointment_type_id:
            return Response({"detail": "staff and appointment_type are required."}, status=status.HTTP_400_BAD_REQUEST)
        date_param = request.query_params.get("date")
        date_from = parse_date(request.query_params.get("date_from") or date_param or "")
        date_to = parse_date(request.query_params.get("date_to") or date_param or "")
        if not date_from or not date_to:
            return Response({"detail": "date or date_from/date_to is required."}, status=status.HTTP_400_BAD_REQUEST)
        slots = find_available_slots(
            staff=User.objects.get(pk=staff_id),
            appointment_type=AppointmentType.objects.get(pk=appointment_type_id),
            date_from=date_from,
            date_to=date_to,
            duration_minutes=(
                int(request.query_params["duration_minutes"])
                if request.query_params.get("duration_minutes")
                else None
            ),
        )
        return Response(
            [{"start_at": slot.start_at.isoformat(), "end_at": slot.end_at.isoformat()} for slot in slots]
        )


def agenda_range_for_day(date_value):
    start = timezone.make_aware(timezone.datetime.combine(date_value, timezone.datetime.min.time()))
    end = start + timedelta(days=1)
    return start, end


class AgendaDayView(APIView):
    permission_classes = [AgendaPermission]

    @extend_schema(
        parameters=[
            OpenApiParameter("date", str),
            OpenApiParameter("staff", int),
            OpenApiParameter("appointment_type", int),
            OpenApiParameter("status", str),
        ],
        responses=AppointmentSerializer(many=True),
    )
    def get(self, request):
        date_value = parse_date(request.query_params.get("date", ""))
        if not date_value:
            return Response({"detail": "date is required."}, status=status.HTTP_400_BAD_REQUEST)
        start, end = agenda_range_for_day(date_value)
        queryset = Appointment.objects.select_related("patient", "appointment_type", "primary_staff").filter(
            start_at__gte=start,
            start_at__lt=end,
        )
        if request.query_params.get("staff"):
            queryset = queryset.filter(primary_staff_id=request.query_params["staff"])
        if request.query_params.get("appointment_type"):
            queryset = queryset.filter(appointment_type_id=request.query_params["appointment_type"])
        if request.query_params.get("status"):
            queryset = queryset.filter(status=request.query_params["status"])
        serializer = AppointmentSerializer(queryset.order_by("start_at"), many=True, context={"request": request})
        return Response(serializer.data)


class AgendaWeekView(APIView):
    permission_classes = [AgendaPermission]

    @extend_schema(
        parameters=[
            OpenApiParameter("date", str),
        ],
        responses=AppointmentSerializer(many=True),
    )
    def get(self, request):
        date_value = parse_date(request.query_params.get("date", ""))
        if not date_value:
            return Response({"detail": "date is required."}, status=status.HTTP_400_BAD_REQUEST)
        week_start = date_value - timedelta(days=date_value.weekday())
        start, _ = agenda_range_for_day(week_start)
        end = start + timedelta(days=7)
        queryset = Appointment.objects.select_related("patient", "appointment_type", "primary_staff").filter(
            start_at__gte=start,
            start_at__lt=end,
        )
        serializer = AppointmentSerializer(queryset.order_by("start_at"), many=True, context={"request": request})
        return Response(serializer.data)
