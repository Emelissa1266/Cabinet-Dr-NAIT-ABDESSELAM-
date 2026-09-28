from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User

from .models import Consultation, MedicalInstruction, Prescription, PrescriptionItem


def raise_drf_validation(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict) from error
    raise serializers.ValidationError(error.messages) from error


class ConsultationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultation
        fields = (
            "id",
            "patient",
            "doctor",
            "consultation_date",
            "consultation_type",
            "reason",
            "patient_complaint",
            "clinical_findings",
            "diagnosis",
            "treatment_plan",
            "recommendations",
            "notes",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "doctor", "created_at", "updated_at")

    def validate(self, attrs):
        doctor = self.context["request"].user
        instance = self.instance or Consultation(doctor=doctor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.doctor = doctor
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return Consultation.objects.create(doctor=self.context["request"].user, **validated_data)


class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = (
            "id",
            "medication_name",
            "dosage",
            "frequency",
            "route",
            "duration",
            "quantity",
            "instructions",
            "start_date",
            "end_date",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        item = self.instance or PrescriptionItem()
        for field, value in attrs.items():
            setattr(item, field, value)
        try:
            item.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True)

    class Meta:
        model = Prescription
        fields = (
            "id",
            "patient",
            "consultation",
            "surgery",
            "doctor",
            "prescribed_at",
            "general_instructions",
            "notes",
            "status",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "doctor", "created_at", "updated_at")

    def validate(self, attrs):
        doctor = self.context["request"].user
        if doctor.role != User.Role.DOCTOR:
            raise serializers.ValidationError("Only doctors can author prescriptions.")
        instance = self.instance or Prescription(doctor=doctor)
        for field, value in attrs.items():
            if field != "items":
                setattr(instance, field, value)
        instance.doctor = doctor
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        prescription = Prescription.objects.create(
            doctor=self.context["request"].user,
            **validated_data,
        )
        for item in items:
            PrescriptionItem.objects.create(prescription=prescription, **item)
        return prescription

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if items is not None:
            instance.items.all().delete()
            for item in items:
                PrescriptionItem.objects.create(prescription=instance, **item)
        return instance


class MedicalInstructionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalInstruction
        fields = (
            "id",
            "patient",
            "consultation",
            "surgery",
            "doctor",
            "title",
            "instruction",
            "priority",
            "status",
            "valid_from",
            "valid_until",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "doctor", "created_at", "updated_at")

    def validate(self, attrs):
        doctor = self.context["request"].user
        if doctor.role != User.Role.DOCTOR:
            raise serializers.ValidationError("Only doctors can author medical instructions.")
        instance = self.instance or MedicalInstruction(doctor=doctor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.doctor = doctor
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return MedicalInstruction.objects.create(doctor=self.context["request"].user, **validated_data)
