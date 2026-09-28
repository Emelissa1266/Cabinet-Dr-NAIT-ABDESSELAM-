"""API utility views."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    responses={
        200: inline_serializer(
            name="HealthCheckResponse",
            fields={
                "status": serializers.CharField(),
                "service": serializers.CharField(),
            },
        )
    }
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Return a simple API health payload."""
    return Response(
        {
            "status": "ok",
            "service": "clinic-management-api",
        }
    )
