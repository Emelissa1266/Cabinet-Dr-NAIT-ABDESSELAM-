from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User

from .models import (
    Appointment,
    AppointmentReschedule,
    AppointmentStaff,
    AppointmentType,
    ClinicClosure,
    StaffTimeOff,
    StaffWorkingHours,
)
from .services import create_appointment


def raise_drf_validation(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict) from error
    raise serializers.ValidationError(error.messages) from error


class AppointmentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentType
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class AppointmentStaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentStaff
        fields = "__all__"
        read_only_fields = ("id", "created_at")


class AppointmentStaffInputSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    role = serializers.CharField(required=False, allow_blank=True)
    is_required = serializers.BooleanField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class AppointmentSerializer(serializers.ModelSerializer):
    staff_members = AppointmentStaffInputSerializer(many=True, required=False)
    end_at = serializers.DateTimeField(required=False)
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)
    patient_name = serializers.SerializerMethodField()
    appointment_type_name = serializers.CharField(source="appointment_type.name", read_only=True)
    primary_staff_name = serializers.CharField(source="primary_staff.get_full_name", read_only=True)

    class Meta:
        model = Appointment
        fields = (
            "id",
            "patient",
            "patient_reference",
            "patient_name",
            "appointment_type",
            "appointment_type_name",
            "primary_staff",
            "primary_staff_name",
            "start_at",
            "end_at",
            "status",
            "reason",
            "notes",
            "internal_notes",
            "consultation",
            "surgery",
            "care_session",
            "staff_members",
            "created_by",
            "cancelled_by",
            "cancelled_at",
            "cancellation_reason",
            "checked_in_at",
            "no_show_at",
            "completed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "created_by",
            "cancelled_by",
            "cancelled_at",
            "checked_in_at",
            "no_show_at",
            "completed_at",
            "created_at",
            "updated_at",
        )

    def get_patient_name(self, obj) -> str:
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    def create(self, validated_data):
        staff_members = validated_data.pop("staff_members", [])
        try:
            return create_appointment(
                actor=self.context["request"].user,
                request=self.context.get("request"),
                staff_members=staff_members,
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)

    def update(self, instance, validated_data):
        validated_data.pop("staff_members", None)
        if "status" in validated_data:
            raise serializers.ValidationError("Use appointment workflow actions to change status.")
        if "start_at" in validated_data or "end_at" in validated_data:
            raise serializers.ValidationError("Use the reschedule action to change appointment times.")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        instance.save()
        return instance


class StaffWorkingHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffWorkingHours
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        instance = self.instance or StaffWorkingHours()
        for field, value in attrs.items():
            setattr(instance, field, value)
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs


class StaffTimeOffSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffTimeOff
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def create(self, validated_data):
        return StaffTimeOff.objects.create(created_by=self.context["request"].user, **validated_data)


class ClinicClosureSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicClosure
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def create(self, validated_data):
        return ClinicClosure.objects.create(created_by=self.context["request"].user, **validated_data)


class AppointmentRescheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentReschedule
        fields = "__all__"
        read_only_fields = ("id", "changed_at")


class CancelAppointmentSerializer(serializers.Serializer):
    reason = serializers.CharField()


class RescheduleAppointmentSerializer(serializers.Serializer):
    new_start_at = serializers.DateTimeField()
    new_end_at = serializers.DateTimeField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True)


class AvailabilitySlotSerializer(serializers.Serializer):
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
