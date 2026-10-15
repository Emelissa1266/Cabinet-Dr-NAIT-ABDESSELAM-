from django.core.exceptions import ValidationError as DjangoValidationError
from io import BytesIO

from django.http import FileResponse
from django.db.models import Count, OuterRef, Q, Subquery
from django.http import Http404
from django.utils.http import content_disposition_header
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import User
from apps.audit.services import record_audit_event

from .models import (
    ClinicalPhoto,
    ClinicalPhotoComparison,
    ClinicalPhotoSet,
    Document,
    DocumentCategory,
)
from .permissions import (
    ClinicalPhotoPermission,
    DocumentCategoryPermission,
    DocumentPermission,
    filter_nurse_care_relevant_patients,
)
from .serializers import (
    ArchiveSerializer,
    ClinicalPhotoComparisonSerializer,
    ClinicalPhotoSerializer,
    ClinicalPhotoSetSerializer,
    DocumentCategorySerializer,
    DocumentSerializer,
)
from .services import archive_clinical_photo, archive_document, audit_file_access, delete_photo_set
from .validators import clinical_photo_max_size, sanitize_filename, sanitized_image_bytes


def drf_validation(error):
    if hasattr(error, "message_dict"):
        return error.message_dict
    return {"detail": error.messages}


def secure_file_response(*, field_file, filename: str, mime_type: str, inline: bool) -> FileResponse:
    response = FileResponse(field_file.open("rb"), content_type=mime_type)
    response["Content-Disposition"] = content_disposition_header(
        as_attachment=not inline,
        filename=sanitize_filename(filename),
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "no-store, private"
    response["Pragma"] = "no-cache"
    response["Referrer-Policy"] = "no-referrer"
    return response


class DocumentCategoryViewSet(viewsets.ModelViewSet):
    queryset = DocumentCategory.objects.all()
    serializer_class = DocumentCategorySerializer
    permission_classes = [DocumentCategoryPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("system_type", "is_active")
    search_fields = ("code", "name", "description")
    ordering = ("name",)

    def _serialized(self, instance):
        return self.get_serializer(instance).data

    def perform_create(self, serializer):
        category = serializer.save()
        record_audit_event(
            user=self.request.user,
            action="DOCUMENT_CATEGORY_CREATED",
            entity_type="DocumentCategory",
            entity_id=category.pk,
            new_data=self._serialized(category),
            request=self.request,
        )

    def perform_update(self, serializer):
        old_data = self._serialized(self.get_object())
        category = serializer.save()
        record_audit_event(
            user=self.request.user,
            action="DOCUMENT_CATEGORY_UPDATED",
            entity_type="DocumentCategory",
            entity_id=category.pk,
            old_data=old_data,
            new_data=self._serialized(category),
            request=self.request,
        )


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [DocumentPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "category": ["exact"],
        "consultation": ["exact"],
        "surgery": ["exact"],
        "prescription": ["exact"],
        "care": ["exact"],
        "appointment": ["exact"],
        "uploaded_by": ["exact"],
        "document_date": ["exact", "gte", "lte"],
        "uploaded_at": ["date", "gte", "lte"],
        "is_archived": ["exact"],
    }
    search_fields = (
        "title",
        "description",
        "original_filename",
        "patient__patient_reference",
        "patient__first_name",
        "patient__last_name",
    )
    ordering_fields = ("document_date", "uploaded_at", "created_at")
    ordering = ("-uploaded_at",)

    def get_queryset(self):
        queryset = Document.objects.select_related(
            "patient",
            "category",
            "uploaded_by",
            "archived_by",
            "consultation",
            "surgery",
            "prescription",
            "care",
            "appointment",
            "surgery_consent",
            "preoperative_requirement",
        )
        if "is_archived" not in self.request.query_params and self.action not in {"retrieve", "archive", "download", "view", "thumbnail"}:
            queryset = queryset.filter(is_archived=False)
        role = getattr(self.request.user, "role", None)
        if role == User.Role.SECRETARY:
            queryset = queryset.filter(
                category__system_type__in=[
                    DocumentCategory.SystemType.ADMINISTRATIVE,
                    DocumentCategory.SystemType.CONSENT,
                ],
            )
        if role == User.Role.NURSE:
            queryset = queryset.filter(care__assigned_nurse=self.request.user) | queryset.filter(
                care__sessions__nurse=self.request.user,
            )
            queryset = queryset.distinct()
        return queryset

    @action(detail=True, methods=["post"])
    @extend_schema(request=ArchiveSerializer)
    def archive(self, request, pk=None):
        serializer = ArchiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            document = archive_document(
                document=self.get_object(),
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request=request,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        document = self.get_object()
        audit_file_access(actor=request.user, obj=document, action="DOCUMENT_DOWNLOADED", request=request)
        return secure_file_response(
            field_file=document.file,
            filename=document.original_filename,
            mime_type=document.mime_type,
            inline=False,
        )

    @action(detail=True, methods=["get"])
    def view(self, request, pk=None):
        document = self.get_object()
        audit_file_access(actor=request.user, obj=document, action="DOCUMENT_VIEWED", request=request)
        return secure_file_response(
            field_file=document.file,
            filename=document.original_filename,
            mime_type=document.mime_type,
            inline=True,
        )

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Documents are archived, not deleted."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


class PrivatePhotoResponseMixin:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store, private"
        response["Pragma"] = "no-cache"
        response["Referrer-Policy"] = "no-referrer"
        return response


class ClinicalPhotoSetViewSet(PrivatePhotoResponseMixin, viewsets.ModelViewSet):
    serializer_class = ClinicalPhotoSetSerializer
    permission_classes = [ClinicalPhotoPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {"patient": ["exact"], "surgery": ["exact"], "consultation": ["exact"],
                        "anatomical_area": ["exact"], "captured_at": ["date", "gte", "lte"]}
    search_fields = ("title", "notes", "anatomical_area", "patient__patient_reference", "patient__first_name", "patient__last_name")
    ordering_fields = ("captured_at", "created_at", "patient__last_name", "patient__first_name", "title")
    ordering = ("-captured_at", "-created_at")

    def get_queryset(self):
        cover = ClinicalPhoto.objects.filter(photo_set_id=OuterRef("pk"), is_archived=False).order_by("-captured_at", "-created_at").values("pk")[:1]
        queryset = ClinicalPhotoSet.objects.select_related("patient", "surgery", "consultation", "created_by").annotate(
            photo_count=Count("photos", filter=Q(photos__is_archived=False), distinct=True),
            cover_photo=Subquery(cover),
        )
        if getattr(self.request.user, "role", None) == User.Role.NURSE:
            queryset = filter_nurse_care_relevant_patients(queryset, self.request.user)
        return queryset

    def destroy(self, request, *args, **kwargs):
        try:
            delete_photo_set(instance=self.get_object(), actor=request.user, request=request)
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClinicalPhotoViewSet(PrivatePhotoResponseMixin, viewsets.ModelViewSet):
    serializer_class = ClinicalPhotoSerializer
    permission_classes = [ClinicalPhotoPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "patient": ["exact"],
        "surgery": ["exact"],
        "consultation": ["exact"],
        "photo_type": ["exact"],
        "anatomical_area": ["exact"],
        "captured_at": ["date", "gte", "lte"],
        "uploaded_by": ["exact"],
        "is_archived": ["exact"],
        "photo_set": ["exact"],
    }
    search_fields = ("description", "notes", "original_filename", "anatomical_area", "photo_set__title", "patient__patient_reference", "patient__first_name", "patient__last_name")
    ordering_fields = ("captured_at", "created_at", "patient__last_name", "patient__first_name", "photo_set__title")
    ordering = ("-captured_at", "-created_at")

    def get_queryset(self):
        queryset = ClinicalPhoto.objects.select_related(
            "patient",
            "surgery",
            "consultation",
            "photo_set",
            "uploaded_by",
            "archived_by",
        )
        if "is_archived" not in self.request.query_params and self.action not in {"retrieve", "archive", "download", "view", "thumbnail"}:
            queryset = queryset.filter(is_archived=False)
        if getattr(self.request.user, "role", None) == User.Role.NURSE:
            queryset = filter_nurse_care_relevant_patients(queryset, self.request.user)
        return queryset

    @action(detail=True, methods=["post"])
    @extend_schema(request=ArchiveSerializer)
    def archive(self, request, pk=None):
        serializer = ArchiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            photo = archive_clinical_photo(
                photo=self.get_object(),
                actor=request.user,
                reason=serializer.validated_data["reason"],
                request=request,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(photo).data)

    @action(detail=False, methods=["get"], url_path="upload-rules")
    def upload_rules(self, request):
        return Response({"max_size": clinical_photo_max_size(), "mime_types": ["image/jpeg", "image/png"]})

    def _image_response(self, request, *, thumbnail=False, inline=True):
        photo = self.get_object()
        try:
            with photo.image.open("rb") as image:
                pixels, mime_type = sanitized_image_bytes(image, thumbnail=thumbnail)
        except FileNotFoundError as error:
            raise Http404("Clinical image unavailable.") from error
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        audit_file_access(actor=request.user, obj=photo,
                          action="CLINICAL_PHOTO_THUMBNAIL_VIEWED" if thumbnail else ("CLINICAL_PHOTO_VIEWED" if inline else "CLINICAL_PHOTO_DOWNLOADED"), request=request)
        response = FileResponse(BytesIO(pixels), content_type=mime_type)
        response["Content-Disposition"] = content_disposition_header(as_attachment=not inline, filename=sanitize_filename(photo.original_filename))
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @action(detail=True, methods=["get"])
    def thumbnail(self, request, pk=None):
        return self._image_response(request, thumbnail=True)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        return self._image_response(request, inline=False)

    @action(detail=True, methods=["get"])
    def view(self, request, pk=None):
        return self._image_response(request)

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Clinical photos are archived, not deleted."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)


class ClinicalPhotoComparisonViewSet(PrivatePhotoResponseMixin, viewsets.ModelViewSet):
    serializer_class = ClinicalPhotoComparisonSerializer
    permission_classes = [ClinicalPhotoPermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ("patient", "surgery", "before_photo", "after_photo")
    ordering = ("-created_at",)

    def get_queryset(self):
        queryset = ClinicalPhotoComparison.objects.select_related(
            "patient",
            "surgery",
            "before_photo",
            "after_photo",
            "created_by",
        )
        if getattr(self.request.user, "role", None) == User.Role.NURSE:
            queryset = filter_nurse_care_relevant_patients(queryset, self.request.user)
        return queryset
