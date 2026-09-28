from django.contrib import admin

from .models import (
    ClinicalPhoto,
    ClinicalPhotoComparison,
    ClinicalPhotoSet,
    Document,
    DocumentCategory,
)


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "system_type", "is_active")
    list_filter = ("system_type", "is_active")
    search_fields = ("code", "name", "description")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "patient",
        "category",
        "original_filename",
        "mime_type",
        "file_size",
        "uploaded_by",
        "uploaded_at",
        "is_archived",
    )
    list_filter = ("category", "mime_type", "is_archived", "uploaded_at")
    search_fields = ("title", "original_filename", "patient__patient_reference", "patient__first_name", "patient__last_name")
    readonly_fields = (
        "stored_filename",
        "mime_type",
        "file_size",
        "checksum",
        "uploaded_by",
        "uploaded_at",
        "archived_at",
        "archived_by",
        "created_at",
        "updated_at",
    )


@admin.register(ClinicalPhotoSet)
class ClinicalPhotoSetAdmin(admin.ModelAdmin):
    list_display = ("title", "patient", "anatomical_area", "captured_at", "surgery", "created_by")
    list_filter = ("anatomical_area", "captured_at")
    search_fields = ("title", "patient__patient_reference", "notes")


@admin.register(ClinicalPhoto)
class ClinicalPhotoAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "photo_type",
        "anatomical_area",
        "view_angle",
        "captured_at",
        "surgery",
        "uploaded_by",
        "is_archived",
    )
    list_filter = ("photo_type", "anatomical_area", "view_angle", "is_archived", "captured_at")
    search_fields = ("patient__patient_reference", "original_filename", "description", "notes")
    readonly_fields = (
        "stored_filename",
        "mime_type",
        "file_size",
        "checksum",
        "width",
        "height",
        "uploaded_by",
        "archived_at",
        "archived_by",
        "created_at",
        "updated_at",
    )


@admin.register(ClinicalPhotoComparison)
class ClinicalPhotoComparisonAdmin(admin.ModelAdmin):
    list_display = ("patient", "surgery", "before_photo", "after_photo", "created_by", "created_at")
    list_filter = ("created_at",)
    search_fields = ("patient__patient_reference", "notes")
