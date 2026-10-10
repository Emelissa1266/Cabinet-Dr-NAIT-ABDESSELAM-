"""Production settings for the Clinic Management API."""

from .base import *
from .validators import validate_production_security_settings

DEBUG = False

SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = env_bool("CSRF_COOKIE_HTTPONLY", True)
AUTH_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env_int("DJANGO_SECURE_HSTS_SECONDS", 31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", False)
SECURE_HSTS_PRELOAD = env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "same-origin")
X_FRAME_OPTIONS = "DENY"
SECURITY_CSP_REPORT_ONLY = env_bool("SECURITY_CSP_REPORT_ONLY", True)
_SECURE_PROXY_SSL_HEADER_ENABLED = env_bool("DJANGO_SECURE_PROXY_SSL_HEADER", False)
if _SECURE_PROXY_SSL_HEADER_ENABLED:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
RATE_LIMIT_REQUIRE_SHARED_CACHE = env_bool("RATE_LIMIT_REQUIRE_SHARED_CACHE", True)

validate_production_security_settings(
    secret_key=SECRET_KEY,
    allowed_hosts=ALLOWED_HOSTS,
    auth_cookie_secure=AUTH_COOKIE_SECURE,
    csrf_cookie_secure=CSRF_COOKIE_SECURE,
    session_cookie_secure=SESSION_COOKIE_SECURE,
    rate_limit_require_shared_cache=RATE_LIMIT_REQUIRE_SHARED_CACHE,
    rate_limit_cache_backend=CACHES.get(RATE_LIMIT_CACHE_ALIAS, {}).get("BACKEND", ""),
    database_engine=DATABASES["default"].get("ENGINE", ""),
    secure_proxy_ssl_header_enabled=_SECURE_PROXY_SSL_HEADER_ENABLED,
    trusted_proxy_ips=TRUSTED_PROXY_IPS,
    hsts_preload=SECURE_HSTS_PRELOAD,
    hsts_include_subdomains=SECURE_HSTS_INCLUDE_SUBDOMAINS,
    hsts_seconds=SECURE_HSTS_SECONDS,
)
