from contextlib import suppress
from typing import ClassVar

from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.services import record_audit_event

from .cookies import clear_auth_cookies, csrf_token_response, enforce_csrf, set_auth_cookies
from .models import User
from .permissions import IsAdmin
from .serializers import AdminUserSerializer, LoginSerializer, LogoutSerializer, UserSerializer


class CookieAuthenticateHeaderMixin:
    def get_authenticate_header(self, request):
        return "Cookie"


@extend_schema(
    description="Authentifier un utilisateur actif du cabinet et définir les cookies JWT HttpOnly.",
    request=LoginSerializer,
    responses={200: UserSerializer},
)
class LoginView(CookieAuthenticateHeaderMixin, APIView):
    authentication_classes: ClassVar[list[type]] = []
    permission_classes: ClassVar[list[type]] = [AllowAny]

    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        response = Response({"user": data["user"]}, status=status.HTTP_200_OK)
        set_auth_cookies(response, access=data["access"], refresh=data["refresh"])
        return response


@extend_schema(description="Refresh HttpOnly JWT cookies with a valid refresh cookie.", responses={200: None})
class RefreshView(CookieAuthenticateHeaderMixin, APIView):
    authentication_classes: ClassVar[list[type]] = []
    permission_classes: ClassVar[list[type]] = [AllowAny]

    def post(self, request):
        enforce_csrf(request)
        refresh = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
        if not refresh:
            raise AuthenticationFailed("No refresh cookie.")

        serializer = TokenRefreshSerializer(data={"refresh": refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError):
            response = Response({"detail": "Refresh token is invalid or expired."}, status=status.HTTP_401_UNAUTHORIZED)
            clear_auth_cookies(response)
            return response

        data = serializer.validated_data
        response = Response(status=status.HTTP_200_OK)
        set_auth_cookies(
            response,
            access=data["access"],
            refresh=data.get("refresh"),
        )
        return response


class LogoutView(APIView):
    permission_classes: ClassVar[list[type]] = [IsAuthenticated]

    @extend_schema(
        description="Blacklist the refresh cookie token and clear authentication cookies.",
        request=LogoutSerializer,
        responses={204: None},
    )
    def post(self, request):
        refresh = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
        if refresh:
            with suppress(TokenError):
                RefreshToken(refresh).blacklist()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class CsrfView(APIView):
    authentication_classes: ClassVar[list[type]] = []
    permission_classes: ClassVar[list[type]] = [AllowAny]

    @extend_schema(description="Set and return the CSRF token used for cookie-authenticated unsafe requests.")
    def get(self, request):
        return csrf_token_response(request)


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
