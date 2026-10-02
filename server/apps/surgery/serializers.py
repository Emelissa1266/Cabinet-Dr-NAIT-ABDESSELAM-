from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User

from .models import (
    AnesthesiaRecord,
    InterventionType,
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


def raise_drf_validation(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict) from error
    raise serializers.ValidationError(error.messages) from error


class SurgerySerializer(serializers.ModelSerializer):
    intervention_type_name = serializers.CharField(source="intervention_type.name", read_only=True)
    intervention_type_code = serializers.CharField(source="intervention_type.code", read_only=True)

    class Meta:
        model = Surgery
        fields = "__all__"
        extra_kwargs = {
            "procedure_name": {"required": False, "allow_blank": True},
            "procedure_code": {"required": False, "allow_blank": True},
        }
        read_only_fields = (
            "id",
            "surgeon",
            "intervention_type_name",
            "intervention_type_code",
            "status",
            "actual_start_at",
            "actual_end_at",
            "cancelled_by",
            "cancelled_at",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        actor = self.context["request"].user
        if actor.role != User.Role.DOCTOR:
            raise serializers.ValidationError("Only doctors can author surgery decisions.")
        selected_type = attrs.get("intervention_type")
        intervention_type_changed = "intervention_type" in attrs and (
            not self.instance or attrs["intervention_type"] != self.instance.intervention_type
        )
        if intervention_type_changed:
            if self.instance and self.instance.status not in {Surgery.Status.DRAFT, Surgery.Status.PLANNED}:
                raise serializers.ValidationError("Intervention identity can only be changed before pre-operative workflow starts.")
            if selected_type and not selected_type.is_active:
                raise serializers.ValidationError("Inactive intervention types cannot be selected for a surgery.")
            if selected_type:
                attrs["procedure_name"] = selected_type.name
                attrs["procedure_code"] = selected_type.code
                if not attrs.get("procedure_description"):
                    attrs["procedure_description"] = selected_type.description
        next_procedure_name = attrs.get("procedure_name", getattr(self.instance, "procedure_name", ""))
        if not selected_type and not str(next_procedure_name).strip():
            raise serializers.ValidationError("Procedure is required when no intervention type is selected.")
        instance = self.instance or Surgery(surgeon=actor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        if not self.instance:
            instance.surgeon = actor
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return Surgery.objects.create(surgeon=self.context["request"].user, **validated_data)


class InterventionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterventionType
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class SurgeryCancelSerializer(serializers.Serializer):
    reason = serializers.CharField()


class PreoperativeAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreoperativeAssessment
        fields = "__all__"
        read_only_fields = ("id", "assessed_by", "created_at", "updated_at")

    def validate(self, attrs):
        actor = self.context["request"].user
        readiness = attrs.get(
            "readiness_status",
            getattr(self.instance, "readiness_status", PreoperativeAssessment.ReadinessStatus.PENDING),
        )
        if readiness in {
            PreoperativeAssessment.ReadinessStatus.READY,
            PreoperativeAssessment.ReadinessStatus.NOT_READY,
        } and actor.role != User.Role.DOCTOR:
            raise serializers.ValidationError("Only doctors can set final surgical readiness.")
        instance = self.instance or PreoperativeAssessment(assessed_by=actor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.assessed_by = actor
        return attrs

    def create(self, validated_data):
        return PreoperativeAssessment.objects.create(assessed_by=self.context["request"].user, **validated_data)


class PreoperativeChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreoperativeChecklistItem
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class SurgeryPreoperativeChecklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurgeryPreoperativeChecklist
        fields = "__all__"
        read_only_fields = ("id", "checked_by", "checked_at")

    def validate(self, attrs):
        from django.utils import timezone

        actor = self.context["request"].user
        instance = self.instance or SurgeryPreoperativeChecklist(checked_by=actor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        if attrs.get("status") in {
            SurgeryPreoperativeChecklist.Status.COMPLETED,
            SurgeryPreoperativeChecklist.Status.NOT_APPLICABLE,
            SurgeryPreoperativeChecklist.Status.BLOCKED,
        }:
            instance.checked_by = actor
            instance.checked_at = instance.checked_at or timezone.now()
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        from django.utils import timezone

        status_value = validated_data.get("status")
        checked_at = (
            timezone.now()
            if status_value
            in {
                SurgeryPreoperativeChecklist.Status.COMPLETED,
                SurgeryPreoperativeChecklist.Status.NOT_APPLICABLE,
                SurgeryPreoperativeChecklist.Status.BLOCKED,
            }
            else None
        )
        return SurgeryPreoperativeChecklist.objects.create(
            checked_by=self.context["request"].user if checked_at else None,
            checked_at=checked_at,
            **validated_data,
        )


class PreoperativeRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreoperativeRequirement
        fields = "__all__"
        read_only_fields = ("id", "reviewed_by", "reviewed_at", "created_at", "updated_at")

    def create(self, validated_data):
        from django.utils import timezone

        reviewed_at = timezone.now() if validated_data.get("status") != PreoperativeRequirement.Status.PENDING else None
        return PreoperativeRequirement.objects.create(
            reviewed_by=self.context["request"].user if reviewed_at else None,
            reviewed_at=reviewed_at,
            **validated_data,
        )


class SurgeryConsentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurgeryConsent
        fields = "__all__"
        read_only_fields = ("id", "confirmed_by", "confirmed_at")

    def create(self, validated_data):
        from django.utils import timezone

        confirmed = validated_data.get("status") == SurgeryConsent.Status.CONFIRMED
        return SurgeryConsent.objects.create(
            confirmed_by=self.context["request"].user if confirmed else None,
            confirmed_at=timezone.now() if confirmed else None,
            **validated_data,
        )


class AnesthesiaRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnesthesiaRecord
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class SurgeryOperativeRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurgeryOperativeRecord
        fields = "__all__"
        read_only_fields = ("id", "surgeon", "created_at", "updated_at")

    def validate(self, attrs):
        actor = self.context["request"].user
        if actor.role != User.Role.DOCTOR:
            raise serializers.ValidationError("Only doctors can author operative records.")
        instance = self.instance or SurgeryOperativeRecord(surgeon=actor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.surgeon = actor
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return SurgeryOperativeRecord.objects.create(surgeon=self.context["request"].user, **validated_data)


class SurgeryTeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurgeryTeamMember
        fields = "__all__"
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        instance = self.instance or SurgeryTeamMember()
        for field, value in attrs.items():
            setattr(instance, field, value)
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs


class IntraoperativeEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntraoperativeEvent
        fields = "__all__"
        read_only_fields = ("id", "recorded_by", "created_at")

    def create(self, validated_data):
        return IntraoperativeEvent.objects.create(recorded_by=self.context["request"].user, **validated_data)


class SurgeryComplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurgeryComplication
        fields = "__all__"
        read_only_fields = ("id", "identified_by", "created_at", "updated_at")

    def validate(self, attrs):
        instance = self.instance or SurgeryComplication(identified_by=self.context["request"].user)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.identified_by = self.context["request"].user
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return SurgeryComplication.objects.create(identified_by=self.context["request"].user, **validated_data)


class PostoperativeAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostoperativeAssessment
        fields = "__all__"
        read_only_fields = ("id", "assessed_by", "created_at", "updated_at")

    def validate(self, attrs):
        actor = self.context["request"].user
        if actor.role != User.Role.DOCTOR:
            raise serializers.ValidationError("Only doctors can author post-operative assessments.")
        instance = self.instance or PostoperativeAssessment(assessed_by=actor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.assessed_by = actor
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return PostoperativeAssessment.objects.create(assessed_by=self.context["request"].user, **validated_data)


class PostoperativeFollowUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostoperativeFollowUp
        fields = "__all__"
        read_only_fields = ("id", "doctor", "created_at", "updated_at")

    def validate(self, attrs):
        actor = self.context["request"].user
        if actor.role != User.Role.DOCTOR:
            raise serializers.ValidationError("Only doctors can author post-operative follow-ups.")
        instance = self.instance or PostoperativeFollowUp(doctor=actor)
        for field, value in attrs.items():
            setattr(instance, field, value)
        instance.doctor = actor
        try:
            instance.clean()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return attrs

    def create(self, validated_data):
        return PostoperativeFollowUp.objects.create(doctor=self.context["request"].user, **validated_data)
