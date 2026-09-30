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

    class Meta:
        model = Care
        fields = (
            "id",
            "patient",
            "care_type",
            "prescribed_by",
            "assigned_nurse",
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
            "total_price",
            "completed_sessions",
            "remaining_sessions",
            "progress_percentage",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        doctor = self.context["request"].user
        if doctor.role != User.Role.DOCTOR:
            raise serializers.ValidationError("Only doctors can prescribe care.")
        instance = self.instance or Care(prescribed_by=doctor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.prescribed_by = doctor
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return Care.objects.create(prescribed_by=self.context["request"].user, **validated_data)


class CareSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareSession
        fields = "__all__"
        read_only_fields = ("id", "nurse", "started_at", "completed_at", "created_at", "updated_at")

    def validate(self, attrs):
        nurse = self.context["request"].user
        if nurse.role != User.Role.NURSE:
            raise serializers.ValidationError("Only nurses can create or modify care sessions.")
        instance = self.instance or CareSession(nurse=nurse)
        for field, value in attrs.items():
            setattr(instance, field, value)
        if not self.instance:
            instance.nurse = nurse
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
