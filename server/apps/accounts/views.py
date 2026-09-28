from typing import ClassVar

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import LoginSerializer, LogoutSerializer, UserSerializer


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
