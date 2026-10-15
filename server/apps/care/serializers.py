from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User

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


def raise_drf_validation(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict) from error
    raise serializers.ValidationError(error.messages) from error


class CareCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CareCategory
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class CareTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareType
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class CareSerializer(serializers.ModelSerializer):
    total_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    completed_sessions = serializers.IntegerField(read_only=True)
    remaining_sessions = serializers.IntegerField(read_only=True)
    progress_percentage = serializers.FloatField(read_only=True)
    patient_name = serializers.SerializerMethodField()
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)
    care_type_name = serializers.CharField(source="care_type.name", read_only=True)
    care_category_name = serializers.CharField(source="care_type.category.name", read_only=True)
    assigned_nurse_name = serializers.SerializerMethodField()
    prescribed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Care
        fields = (
            "id",
            "patient",
            "patient_name",
            "patient_reference",
            "care_type",
            "care_type_name",
            "care_category_name",
            "prescribed_by",
            "prescribed_by_name",
            "assigned_nurse",
            "assigned_nurse_name",
            "consultation",
            "medical_instruction",
            "surgery",
            "start_date",
            "end_date",
            "planned_sessions",
            "price_per_session",
            "total_price",
            "completed_sessions",
            "remaining_sessions",
            "progress_percentage",
            "status",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "prescribed_by",
            "patient_name",
            "patient_reference",
            "care_type_name",
            "care_category_name",
            "assigned_nurse_name",
            "prescribed_by_name",
            "total_price",
            "completed_sessions",
            "remaining_sessions",
            "progress_percentage",
            "created_at",
            "updated_at",
        )

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    def get_assigned_nurse_name(self, obj):
        if not obj.assigned_nurse:
            return ""
        return obj.assigned_nurse.get_full_name() or obj.assigned_nurse.username

    def get_prescribed_by_name(self, obj):
        return obj.prescribed_by.get_full_name() or obj.prescribed_by.username

    def to_internal_value(self, data):
        user = self.context["request"].user
        if user.role == User.Role.NURSE and "assigned_nurse" in data:
            raise serializers.ValidationError({"assigned_nurse": "L'infirmier responsable est déterminé automatiquement."})
        return super().to_internal_value(data)

    def validate(self, attrs):
        actor = self.context["request"].user
        if actor.role not in {User.Role.DOCTOR, User.Role.NURSE}:
            raise serializers.ValidationError("Only doctors and nurses can create or modify care.")
        if (
            self.instance
            and actor.role == User.Role.NURSE
            and self.instance.assigned_nurse_id != actor.id
            and not (self.instance.assigned_nurse_id is None and self.instance.prescribed_by_id == actor.id)
        ):
            raise serializers.ValidationError("This care is outside the nurse workspace.")
        instance = self.instance or Care(prescribed_by=actor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        if not self.instance:
            instance.prescribed_by = actor
        if actor.role == User.Role.NURSE:
            instance.assigned_nurse = actor
        completed = instance.completed_sessions if instance.pk else 0
        if instance.planned_sessions < completed:
            raise serializers.ValidationError("Planned sessions cannot be lower than completed sessions.")
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        actor = self.context["request"].user
        if actor.role == User.Role.NURSE:
            validated_data["assigned_nurse"] = actor
        return Care.objects.create(prescribed_by=actor, **validated_data)

    def update(self, instance, validated_data):
        actor = self.context["request"].user
        if actor.role == User.Role.NURSE:
            validated_data["assigned_nurse"] = actor
        return super().update(instance, validated_data)


class CareSessionSerializer(serializers.ModelSerializer):
    writable_create_fields = {"care", "scheduled_at", "notes"}
    writable_update_fields = {"scheduled_at", "notes"}
    patient_name = serializers.SerializerMethodField()
    patient_reference = serializers.CharField(source="care.patient.patient_reference", read_only=True)
    care_type_name = serializers.CharField(source="care.care_type.name", read_only=True)
    care_category_name = serializers.CharField(source="care.care_type.category.name", read_only=True)
    care_status = serializers.CharField(source="care.status", read_only=True)
    care_start_date = serializers.DateField(source="care.start_date", read_only=True)
    care_total_price = serializers.DecimalField(source="care.total_price", max_digits=12, decimal_places=2, read_only=True)
    planned_sessions = serializers.IntegerField(source="care.planned_sessions", read_only=True)
    completed_sessions = serializers.IntegerField(source="care.completed_sessions", read_only=True)
    remaining_sessions = serializers.IntegerField(source="care.remaining_sessions", read_only=True)
    progress_percentage = serializers.FloatField(source="care.progress_percentage", read_only=True)

    class Meta:
        model = CareSession
        fields = (
            "id",
            "care",
            "nurse",
            "scheduled_at",
            "started_at",
            "completed_at",
            "status",
            "notes",
            "patient_name",
            "patient_reference",
            "care_type_name",
            "care_category_name",
            "care_status",
            "care_start_date",
            "care_total_price",
            "planned_sessions",
            "completed_sessions",
            "remaining_sessions",
            "progress_percentage",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "nurse",
            "status",
            "started_at",
            "completed_at",
            "patient_name",
            "patient_reference",
            "care_type_name",
            "care_category_name",
            "care_status",
            "care_start_date",
            "care_total_price",
            "planned_sessions",
            "completed_sessions",
            "remaining_sessions",
            "progress_percentage",
            "created_at",
            "updated_at",
        )

    def get_patient_name(self, obj):
        return f"{obj.care.patient.first_name} {obj.care.patient.last_name}".strip()

    def to_internal_value(self, data):
        allowed = self.writable_update_fields if self.instance else self.writable_create_fields
        unexpected = set(data.keys()) - allowed
        if unexpected:
            raise serializers.ValidationError({field: "Ce champ n'est pas modifiable pour une séance de soin." for field in sorted(unexpected)})
        return super().to_internal_value(data)

    def validate(self, attrs):
        nurse = self.context["request"].user
        if nurse.role != User.Role.NURSE:
            raise serializers.ValidationError("Only nurses can create or modify care sessions.")
        instance = self.instance or CareSession(nurse=nurse)
        for field, value in attrs.items():
            setattr(instance, field, value)
        if not self.instance:
            instance.nurse = nurse
        if instance.care_id and instance.care.assigned_nurse_id != nurse.id and not (
            instance.care.assigned_nurse_id is None and instance.care.prescribed_by_id == nurse.id
        ):
            raise serializers.ValidationError("Only the responsible nurse can register this care session.")
        if instance.care_id and instance.care.status in {Care.Status.COMPLETED, Care.Status.CANCELLED}:
            raise serializers.ValidationError("Completed or cancelled care cannot receive a new session.")
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return CareSession.objects.create(nurse=self.context["request"].user, **validated_data)


class CareObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareObservation
        fields = "__all__"
        read_only_fields = ("id", "nurse", "created_at", "updated_at")

    def validate(self, attrs):
        nurse = self.context["request"].user
        instance = self.instance or CareObservation(nurse=nurse)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.nurse = nurse
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return CareObservation.objects.create(nurse=self.context["request"].user, **validated_data)


class ClinicalMeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicalMeasurement
        fields = "__all__"
        read_only_fields = ("id", "recorded_by", "created_at")

    def validate(self, attrs):
        nurse = self.context["request"].user
        instance = self.instance or ClinicalMeasurement(recorded_by=nurse)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.recorded_by = nurse
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return ClinicalMeasurement.objects.create(recorded_by=self.context["request"].user, **validated_data)


class CareSessionMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareSessionMaterial
        fields = "__all__"
        read_only_fields = ("id", "recorded_by", "created_at")

    def validate(self, attrs):
        nurse = self.context["request"].user
        instance = self.instance or CareSessionMaterial(recorded_by=nurse)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.recorded_by = nurse
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return CareSessionMaterial.objects.create(recorded_by=self.context["request"].user, **validated_data)


class CareParameterDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareParameterDefinition
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class CareSessionParameterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareSessionParameter
        fields = "__all__"
        read_only_fields = ("id", "recorded_by", "created_at", "updated_at")

    def validate(self, attrs):
        nurse = self.context["request"].user
        instance = self.instance or CareSessionParameter(recorded_by=nurse)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.recorded_by = nurse
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return CareSessionParameter.objects.create(recorded_by=self.context["request"].user, **validated_data)
