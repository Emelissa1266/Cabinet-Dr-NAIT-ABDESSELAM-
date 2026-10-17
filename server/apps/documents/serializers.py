from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User

from .models import (
    ClinicalPhoto,
    ClinicalPhotoComparison,
    ClinicalPhotoSet,
    Document,
    DocumentCategory,
)
from .permissions import is_care_relevant, is_patient_care_relevant
from .services import (
    create_photo_comparison,
    save_photo_set,
    update_clinical_photo,
    upload_clinical_photo,
    upload_document,
)


def raise_drf_validation(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict) from error
    raise serializers.ValidationError(error.messages) from error


class DocumentCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentCategory
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class DocumentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True, required=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "patient",
            "patient_reference",
            "category",
            "category_name",
            "title",
            "description",
            "file",
            "original_filename",
            "mime_type",
            "file_size",
            "checksum",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
            "document_date",
            "consultation",
            "surgery",
            "prescription",
            "care",
            "appointment",
            "surgery_consent",
            "preoperative_requirement",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "original_filename",
            "mime_type",
            "file_size",
            "checksum",
            "uploaded_by",
            "uploaded_at",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        category = attrs.get("category") or getattr(self.instance, "category", None)
        if user.role == User.Role.SECRETARY and category.system_type not in {
            DocumentCategory.SystemType.ADMINISTRATIVE,
            DocumentCategory.SystemType.CONSENT,
        }:
            raise serializers.ValidationError("Secretaries may upload administrative or consent documents only.")
        if user.role == User.Role.NURSE:
            probe = Document(**{k: v for k, v in attrs.items() if k != "file"})
            if not is_care_relevant(user, probe):
                raise serializers.ValidationError("Nurses may upload care-relevant documents only.")
        return attrs

    def create(self, validated_data):
        uploaded_file = validated_data.pop("file")
        try:
            return upload_document(
                actor=self.context["request"].user,
                request=self.context.get("request"),
                uploaded_file=uploaded_file,
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)

    def update(self, instance, validated_data):
        validated_data.pop("file", None)
        if instance.is_archived:
            raise serializers.ValidationError("Archived documents cannot be modified.")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            instance.save()
        except DjangoValidationError as error:
            raise_drf_validation(error)
        return instance


class ClinicalPhotoSetSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)
    photo_count = serializers.IntegerField(read_only=True)
    cover_photo = serializers.IntegerField(read_only=True, allow_null=True)

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    class Meta:
        model = ClinicalPhotoSet
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        patient = attrs.get("patient") or getattr(self.instance, "patient", None)
        if user.role == User.Role.NURSE and not is_patient_care_relevant(user, getattr(patient, "id", None)):
            raise serializers.ValidationError("Nurses may manage clinical photo sets for care-relevant patients only.")
        return attrs

    def create(self, validated_data):
        try:
            return save_photo_set(actor=self.context["request"].user, request=self.context["request"], **validated_data)
        except DjangoValidationError as error:
            raise_drf_validation(error)

    def update(self, instance, validated_data):
        try:
            return save_photo_set(instance=instance, actor=self.context["request"].user,
                                  request=self.context["request"], **validated_data)
        except DjangoValidationError as error:
            raise_drf_validation(error)


class ClinicalPhotoSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    photo_set_title = serializers.CharField(source="photo_set.title", read_only=True, default="")

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip()

    image = serializers.ImageField(write_only=True, required=True)
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True)

    class Meta:
        model = ClinicalPhoto
        fields = (
            "id",
            "patient",
            "patient_reference",
            "patient_name",
            "photo_set_title",
            "surgery",
            "consultation",
            "photo_set",
            "uploaded_by",
            "uploaded_by_name",
            "image",
            "original_filename",
            "mime_type",
            "file_size",
            "checksum",
            "width",
            "height",
            "photo_type",
            "anatomical_area",
            "view_angle",
            "captured_at",
            "description",
            "notes",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uploaded_by",
            "original_filename",
            "mime_type",
            "file_size",
            "checksum",
            "width",
            "height",
            "is_archived",
            "archived_at",
            "archived_by",
            "archive_reason",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        patient = attrs.get("patient") or getattr(self.instance, "patient", None)
        if user.role == User.Role.NURSE and not is_patient_care_relevant(user, getattr(patient, "id", None)):
            raise serializers.ValidationError("Nurses may manage clinical photos for care-relevant patients only.")
        return attrs

    def create(self, validated_data):
        uploaded_file = validated_data.pop("image")
        try:
            return upload_clinical_photo(
                actor=self.context["request"].user,
                request=self.context.get("request"),
                uploaded_file=uploaded_file,
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)

    def update(self, instance, validated_data):
        validated_data.pop("image", None)
        try:
            return update_clinical_photo(instance=instance, actor=self.context["request"].user,
                                         request=self.context["request"], **validated_data)
        except DjangoValidationError as error:
            raise_drf_validation(error)


class ClinicalPhotoComparisonSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicalPhotoComparison
        fields = "__all__"
        read_only_fields = ("id", "created_by", "created_at")

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        patient = attrs.get("patient") or getattr(self.instance, "patient", None)
        if user.role == User.Role.NURSE and not is_patient_care_relevant(user, getattr(patient, "id", None)):
            raise serializers.ValidationError("Nurses may manage photo comparisons for care-relevant patients only.")
        return attrs

    def create(self, validated_data):
        try:
            return create_photo_comparison(
                actor=self.context["request"].user,
                request=self.context.get("request"),
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation(error)


class ArchiveSerializer(serializers.Serializer):
    reason = serializers.CharField()
