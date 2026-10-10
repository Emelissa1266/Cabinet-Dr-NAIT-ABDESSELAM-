"""Settings validation helpers for production hardening."""

from __future__ import annotations

from django.core.exceptions import ImproperlyConfigured

UNSAFE_SECRET_KEYS = {
    "",
    "unsafe-development-secret-key-change-before-real-use",
    "replace-with-a-local-development-secret-key",
}
UNSAFE_HOSTS = {"*", "localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"}


def validate_production_security_settings(
    *,
    secret_key: str,
    allowed_hosts: list[str],
    auth_cookie_secure: bool,
    csrf_cookie_secure: bool,
    session_cookie_secure: bool,
    rate_limit_require_shared_cache: bool,
    rate_limit_cache_backend: str,
    database_engine: str,
    secure_proxy_ssl_header_enabled: bool,
    trusted_proxy_ips: list[str],
    hsts_preload: bool,
    hsts_include_subdomains: bool,
    hsts_seconds: int,
) -> None:
    """Fail production startup for unsafe deployment defaults."""
    if not secret_key or secret_key in UNSAFE_SECRET_KEYS or secret_key.startswith("replace-"):
        raise ImproperlyConfigured("Production requires a real DJANGO_SECRET_KEY.")

    if not allowed_hosts:
        raise ImproperlyConfigured("Production requires explicit DJANGO_ALLOWED_HOSTS.")
    unsafe_hosts = UNSAFE_HOSTS.intersection(allowed_hosts)
    if unsafe_hosts:
        hosts = ", ".join(sorted(unsafe_hosts))
        raise ImproperlyConfigured(f"Production ALLOWED_HOSTS contains unsafe values: {hosts}.")

    if not (auth_cookie_secure and csrf_cookie_secure and session_cookie_secure):
        raise ImproperlyConfigured("Production cookies must be Secure.")

    if "postgresql" not in (database_engine or "").lower():
        raise ImproperlyConfigured("Production requires a PostgreSQL database configuration.")

    backend = (rate_limit_cache_backend or "").lower()
    if rate_limit_require_shared_cache and (
        not backend or "locmem" in backend or "dummy" in backend
    ):
        raise ImproperlyConfigured("Production rate limiting requires a shared cache backend.")

    if secure_proxy_ssl_header_enabled and not trusted_proxy_ips:
        raise ImproperlyConfigured(
            "SECURE_PROXY_SSL_HEADER requires TRUSTED_PROXY_IPS and reverse-proxy "
            "header sanitization."
        )

    if hsts_preload and (not hsts_include_subdomains or hsts_seconds < 31536000):
        raise ImproperlyConfigured(
            "HSTS preload requires at least one year of HSTS and includeSubDomains."
        )
