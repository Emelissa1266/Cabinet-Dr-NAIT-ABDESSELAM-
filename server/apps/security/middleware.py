"""Small response hardening middleware for API and private clinical data."""

from __future__ import annotations

from django.conf import settings


class SecurityHeadersMiddleware:
    """Apply conservative headers without changing endpoint behavior."""

    sensitive_prefixes = ("/api/v1/", "/api/schema/", "/api/docs/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        self._set_common_headers(response)
        self._set_cache_headers(request, response)
        self._set_csp_headers(response)
        return response

    def _set_common_headers(self, response) -> None:
        permissions_policy = getattr(settings, "SECURITY_PERMISSIONS_POLICY", "")
        if permissions_policy:
            response.setdefault("Permissions-Policy", permissions_policy)
        response.setdefault(
            "Referrer-Policy",
            getattr(settings, "SECURE_REFERRER_POLICY", "same-origin"),
        )

    def _set_cache_headers(self, request, response) -> None:
        if not request.path.startswith(self.sensitive_prefixes):
            return
        if request.path == "/api/v1/health/":
            return
        response.setdefault("Cache-Control", "no-store, private")
        response.setdefault("Pragma", "no-cache")

    def _set_csp_headers(self, response) -> None:
        report_only_policy = getattr(settings, "SECURITY_CSP_REPORT_ONLY_POLICY", "")
        if getattr(settings, "SECURITY_CSP_REPORT_ONLY", False) and report_only_policy:
            response.setdefault("Content-Security-Policy-Report-Only", report_only_policy)
