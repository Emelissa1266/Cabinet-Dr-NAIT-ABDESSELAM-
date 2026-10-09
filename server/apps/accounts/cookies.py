from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.middleware.csrf import get_token
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response


def _seconds(value: timedelta) -> int:
    return int(value.total_seconds())


def access_cookie_max_age() -> int:
    return _seconds(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"])


def refresh_cookie_max_age() -> int:
    return _seconds(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"])


def _cookie_options(path: str, max_age: int | None) -> dict:
    return {
        "max_age": max_age,
        "path": path,
        "domain": settings.AUTH_COOKIE_DOMAIN,
        "secure": settings.AUTH_COOKIE_SECURE,
        "httponly": True,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
    }


def set_auth_cookies(response: Response, *, access: str, refresh: str | None = None) -> None:
    response.set_cookie(
        settings.AUTH_ACCESS_COOKIE_NAME,
        access,
        **_cookie_options(settings.AUTH_ACCESS_COOKIE_PATH, access_cookie_max_age()),
    )
    if refresh is not None:
        response.set_cookie(
            settings.AUTH_REFRESH_COOKIE_NAME,
            refresh,
            **_cookie_options(settings.AUTH_REFRESH_COOKIE_PATH, refresh_cookie_max_age()),
        )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        settings.AUTH_ACCESS_COOKIE_NAME,
        path=settings.AUTH_ACCESS_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


def csrf_token_response(request) -> Response:
    return Response({"csrfToken": get_token(request)})


def enforce_csrf(request) -> None:
    check = CSRFCheck(lambda req: None)
    django_request = getattr(request, "_request", request)
    check.process_request(django_request)
    reason = check.process_view(django_request, None, (), {})
    if reason:
        raise PermissionDenied(f"CSRF Failed: {reason}")
