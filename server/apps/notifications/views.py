from django.core.exceptions import ValidationError as DjangoValidationError
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import MarkAllReadSerializer, NotificationSerializer, UnreadCountSerializer
from .services import mark_all_notifications_read, mark_notification_read, mark_notification_unread


def drf_validation(error):
    if hasattr(error, "message_dict"):
        return error.message_dict
    return {"detail": error.messages}


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = {
        "is_read": ["exact"],
        "notification_type": ["exact"],
        "priority": ["exact"],
        "created_at": ["date", "gte", "lte"],
    }
    ordering_fields = ("created_at", "priority")
    ordering = ("-created_at",)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        if not self.request.user.is_authenticated:
            return Notification.objects.none()
        return Notification.objects.select_related(
            "recipient",
            "patient",
            "appointment",
            "surgery",
            "care",
            "care_session",
            "invoice",
        ).filter(recipient=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        try:
            notification = mark_notification_read(
                notification=self.get_object(),
                actor=request.user,
                request=request,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(notification).data)

    @action(detail=True, methods=["post"], url_path="mark-unread")
    def mark_unread(self, request, pk=None):
        try:
            notification = mark_notification_unread(
                notification=self.get_object(),
                actor=request.user,
                request=request,
            )
        except DjangoValidationError as error:
            return Response(drf_validation(error), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(notification).data)

    @extend_schema(responses=MarkAllReadSerializer)
    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = mark_all_notifications_read(actor=request.user, request=request)
        return Response({"updated": updated})

    @extend_schema(responses=UnreadCountSerializer)
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"unread_count": self.get_queryset().filter(is_read=False).count()})
