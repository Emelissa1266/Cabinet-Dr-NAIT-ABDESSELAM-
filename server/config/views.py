"""API utility views."""

from drf_spectacular.utils import extend_schema, inline_serializer
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response


class IsAdminRole(BasePermission):
    message = "API documentation is restricted to administrators."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(getattr(user, "is_authenticated", False) and getattr(user, "role", None) == "ADMIN")


class ProtectedSpectacularAPIView(SpectacularAPIView):
    permission_classes = [IsAdminRole]


class ProtectedSpectacularSwaggerView(SpectacularSwaggerView):
    permission_classes = [IsAdminRole]


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
