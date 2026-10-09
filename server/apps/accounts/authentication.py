from __future__ import annotations

from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication

from .cookies import enforce_csrf

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticate SimpleJWT access tokens carried by HttpOnly cookies."""

    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.AUTH_ACCESS_COOKIE_NAME)
        if raw_token is None:
            return None

        if request.method not in SAFE_METHODS:
            enforce_csrf(request)

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token

    def authenticate_header(self, request) -> str:
        return "Cookie"
