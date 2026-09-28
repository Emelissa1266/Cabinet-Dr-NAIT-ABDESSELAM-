from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    patient_reference = serializers.CharField(source="patient.patient_reference", read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "recipient",
            "notification_type",
            "priority",
            "title",
            "message",
            "is_read",
            "read_at",
            "patient",
            "patient_reference",
            "appointment",
            "surgery",
            "care",
            "care_session",
            "invoice",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class UnreadCountSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()


class MarkAllReadSerializer(serializers.Serializer):
    updated = serializers.IntegerField()
