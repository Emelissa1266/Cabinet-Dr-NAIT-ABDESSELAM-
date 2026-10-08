from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import (
    MedicalAlert,
    Patient,
    PatientAllergy,
    PatientChronicCondition,
    PatientClinicalNote,
    PatientContraindication,
    PatientMedicalHistory,
    PatientMedication,
    PatientSurgicalHistory,
)


class PatientMedicalInfoSerializer(serializers.Serializer):
    allergies = serializers.SerializerMethodField()
    medical_history = serializers.SerializerMethodField()
    surgical_history = serializers.SerializerMethodField()
    chronic_conditions = serializers.SerializerMethodField()
    medications = serializers.SerializerMethodField()
    contraindications = serializers.SerializerMethodField()
    clinical_notes = serializers.SerializerMethodField()

    def _medical_items(self, manager, *extra_fields):
        fields = ("id", "title", "description", "is_active", "created_at", *extra_fields)
        return list(manager.filter(is_active=True).values(*fields))

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_allergies(self, patient):
        return self._medical_items(patient.patientallergys, "severity")

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_medical_history(self, patient):
        return self._medical_items(patient.patientmedicalhistorys)

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_surgical_history(self, patient):
        return self._medical_items(patient.patientsurgicalhistorys, "surgery_date")

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_chronic_conditions(self, patient):
        return self._medical_items(patient.patientchronicconditions, "diagnosed_at")

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_medications(self, patient):
        return self._medical_items(patient.patientmedications, "dosage", "frequency")

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_contraindications(self, patient):
        return self._medical_items(patient.patientcontraindications)

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_clinical_notes(self, patient):
        return list(
            patient.clinical_notes.values(
                "id",
                "note",
                "created_at",
            )
        )


class PatientSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    updated_by_name = serializers.CharField(source="updated_by.get_full_name", read_only=True)
    medical_information = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = (
            "id",
            "patient_reference",
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
            "phone",
            "email",
            "address",
            "city",
            "emergency_contact",
            "emergency_phone",
            "profession",
            "notes",
            "is_active",
            "medical_information",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
        )
        read_only_fields = (
            "id",
            "patient_reference",
            "medical_information",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
        )

    @extend_schema_field(PatientMedicalInfoSerializer(allow_null=True))
    def get_medical_information(self, patient):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or user.role == "SECRETARY":
            return None
        return PatientMedicalInfoSerializer(patient).data


class PatientAllergySerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientAllergy
        fields = "__all__"


class PatientMedicalHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientMedicalHistory
        fields = "__all__"


class PatientSurgicalHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientSurgicalHistory
        fields = "__all__"


class PatientChronicConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientChronicCondition
        fields = "__all__"


class PatientMedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientMedication
        fields = "__all__"


class PatientContraindicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientContraindication
        fields = "__all__"


class PatientClinicalNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientClinicalNote
        fields = "__all__"


class MedicalAlertSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    resolved_by_name = serializers.CharField(source="resolved_by.get_full_name", read_only=True)

    class Meta:
        model = MedicalAlert
        fields = (
            "id",
            "patient",
            "patient_name",
            "category",
            "severity",
            "title",
            "description",
            "is_active",
            "created_by",
            "created_by_name",
            "resolved_by",
            "resolved_by_name",
            "resolved_at",
            "resolution_note",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "patient_name",
            "created_by",
            "created_by_name",
            "resolved_by",
            "resolved_by_name",
            "resolved_at",
            "created_at",
            "updated_at",
        )

    def get_patient_name(self, obj) -> str:
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    def validate(self, attrs):
        if self.instance and "patient" in attrs and attrs["patient"] != self.instance.patient:
            raise serializers.ValidationError({"patient": "Medical alert patient cannot be changed."})
        return attrs
