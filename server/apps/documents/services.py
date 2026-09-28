from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event

from .models import ClinicalPhoto, ClinicalPhotoComparison, Document
from .validators import (
    ALLOWED_DOCUMENT_MIME_TYPES,
    clinical_photo_max_size,
    document_max_size,
    sanitize_filename,
    validate_image_file,
    validate_uploaded_file,
)


def cleanup_file(field_file):
    if field_file and field_file.name:
        field_file.storage.delete(field_file.name)


def upload_document(*, actor, request=None, uploaded_file, **validated_data) -> Document:
    mime_type, checksum, file_size = validate_uploaded_file(
        uploaded_file,
        allowed_mime_types=ALLOWED_DOCUMENT_MIME_TYPES,
        max_size=document_max_size(),
    )
    document = Document(
        file=uploaded_file,
        original_filename=sanitize_filename(uploaded_file.name),
        mime_type=mime_type,
        file_size=file_size,
        checksum=checksum,
        uploaded_by=actor,
        **validated_data,
    )
    try:
        with transaction.atomic():
            document.save()
            record_audit_event(
                user=actor,
                action="DOCUMENT_UPLOADED",
                entity_type="Document",
                entity_id=document.pk,
                new_data={"patient": document.patient_id, "checksum": document.checksum},
                request=request,
            )
    except Exception:
        cleanup_file(document.file)
        raise
    return document


def upload_clinical_photo(*, actor, request=None, uploaded_file, **validated_data) -> ClinicalPhoto:
    mime_type, checksum, file_size, width, height = validate_image_file(
        uploaded_file,
        max_size=clinical_photo_max_size(),
    )
    photo = ClinicalPhoto(
        image=uploaded_file,
        original_filename=sanitize_filename(uploaded_file.name),
        mime_type=mime_type,
        file_size=file_size,
        checksum=checksum,
        width=width,
        height=height,
        uploaded_by=actor,
        **validated_data,
    )
    try:
        with transaction.atomic():
            photo.save()
            record_audit_event(
                user=actor,
                action="CLINICAL_PHOTO_UPLOADED",
                entity_type="ClinicalPhoto",
                entity_id=photo.pk,
                new_data={"patient": photo.patient_id, "checksum": photo.checksum},
                request=request,
            )
    except Exception:
        cleanup_file(photo.image)
        raise
    return photo


def archive_document(*, document: Document, actor, reason: str, request=None) -> Document:
    with transaction.atomic():
        document = Document.objects.select_for_update().get(pk=document.pk)
        if document.is_archived:
            raise ValidationError("Document is already archived.")
        document.is_archived = True
        document.archived_at = timezone.now()
        document.archived_by = actor
        document.archive_reason = reason
        document.save(update_fields=["is_archived", "archived_at", "archived_by", "archive_reason", "updated_at"])
        record_audit_event(
            user=actor,
            action="DOCUMENT_ARCHIVED",
            entity_type="Document",
            entity_id=document.pk,
            new_data={"reason": reason},
            request=request,
        )
        return document


def archive_clinical_photo(*, photo: ClinicalPhoto, actor, reason: str, request=None) -> ClinicalPhoto:
    with transaction.atomic():
        photo = ClinicalPhoto.objects.select_for_update().get(pk=photo.pk)
        if photo.is_archived:
            raise ValidationError("Clinical photo is already archived.")
        photo.is_archived = True
        photo.archived_at = timezone.now()
        photo.archived_by = actor
        photo.archive_reason = reason
        photo.save(update_fields=["is_archived", "archived_at", "archived_by", "archive_reason", "updated_at"])
        record_audit_event(
            user=actor,
            action="CLINICAL_PHOTO_ARCHIVED",
            entity_type="ClinicalPhoto",
            entity_id=photo.pk,
            new_data={"reason": reason},
            request=request,
        )
        return photo


def audit_file_access(*, actor, obj, action: str, request=None):
    record_audit_event(
        user=actor,
        action=action,
        entity_type=obj.__class__.__name__,
        entity_id=obj.pk,
        new_data={"checksum": obj.checksum},
        request=request,
    )


def create_photo_comparison(*, actor, request=None, **validated_data) -> ClinicalPhotoComparison:
    with transaction.atomic():
        comparison = ClinicalPhotoComparison.objects.create(created_by=actor, **validated_data)
        record_audit_event(
            user=actor,
            action="CLINICAL_PHOTO_COMPARISON_CREATED",
            entity_type="ClinicalPhotoComparison",
            entity_id=comparison.pk,
            new_data={
                "before_photo": comparison.before_photo_id,
                "after_photo": comparison.after_photo_id,
            },
            request=request,
        )
        return comparison
