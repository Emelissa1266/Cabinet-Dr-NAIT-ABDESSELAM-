from typing import ClassVar

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.audit.services import record_audit_event

from .models import User
from .permissions import IsAdmin
from .serializers import AdminUserSerializer, LoginSerializer, LogoutSerializer, UserSerializer


@extend_schema(
    description="Authenticate an active clinic user and return JWT tokens with role/profile data.",
    responses={200: LoginSerializer},
)
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


@extend_schema(description="Refresh an access token with a valid refresh token.")
class RefreshView(TokenRefreshView):
    pass


class LogoutView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAuthenticated]

    @extend_schema(
        description="Blacklist a refresh token so it can no longer be used.",
        request=LogoutSerializer,
        responses={204: None, 400: None},
    )
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = RefreshToken(serializer.validated_data["refresh"])
        token.blacklist()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAuthenticated]

    @extend_schema(
        description="Return the currently authenticated active user's profile and role.",
        responses={200: UserSerializer},
    )
    def get(self, request):
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(serializer.data)


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.order_by("role", "last_name", "first_name", "username")
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ("role", "is_active")
    search_fields = ("username", "first_name", "last_name", "email", "professional_title")
    ordering_fields = ("username", "last_name", "first_name", "role", "created_at", "updated_at")
    ordering = ("role", "last_name", "first_name", "username")

    def _serialized(self, instance):
        return self.get_serializer(instance).data

    def perform_create(self, serializer):
        user = serializer.save()
        record_audit_event(
            user=self.request.user,
            action="ADMIN_USER_CREATED",
            entity_type="User",
            entity_id=user.pk,
            new_data=self._serialized(user),
            request=self.request,
        )

    def perform_update(self, serializer):
        target = self.get_object()
        old_data = self._serialized(target)
        user = serializer.save()
        action = "ADMIN_USER_UPDATED"
        if old_data.get("role") != user.role:
            action = "ADMIN_USER_ROLE_CHANGED"
        if old_data.get("is_active") != user.is_active:
            action = "ADMIN_USER_ACTIVATION_CHANGED"
        record_audit_event(
            user=self.request.user,
            action=action,
            entity_type="User",
            entity_id=user.pk,
            old_data=old_data,
            new_data=self._serialized(user),
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Users are deactivated, not deleted."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
