"""Production settings for the Clinic Management API."""

from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
AUTH_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env_int("DJANGO_SECURE_HSTS_SECONDS", 31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
SECURE_HSTS_PRELOAD = env_bool("DJANGO_SECURE_HSTS_PRELOAD", True)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
USE_X_FORWARDED_HOST = True
if env_bool("DJANGO_SECURE_PROXY_SSL_HEADER", True):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "production": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "production",
        }
    },
    "root": {"handlers": ["console"], "level": os.getenv("DJANGO_LOG_LEVEL", "INFO")},
    "loggers": {
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}


def _validate_production_settings():
    problems = []
    if SECRET_KEY.startswith(("unsafe-", "replace-")) or len(SECRET_KEY) < 50:
        problems.append("DJANGO_SECRET_KEY must be a generated value of at least 50 characters.")
    if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":
        problems.append("Production requires PostgreSQL; configure DATABASE_URL.")
    if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
        problems.append("DJANGO_ALLOWED_HOSTS must contain explicit LAN hostnames or addresses.")
    if not CSRF_TRUSTED_ORIGINS or any(not origin.startswith("https://") for origin in CSRF_TRUSTED_ORIGINS):
        problems.append("CSRF_TRUSTED_ORIGINS must contain only HTTPS origins in production.")
    if AUTH_COOKIE_SAMESITE not in {"Lax", "Strict"}:
        problems.append("AUTH_COOKIE_SAMESITE must be Lax or Strict for the same-origin deployment.")
    if problems:
        raise ImproperlyConfigured("Production configuration errors: " + " ".join(problems))


_validate_production_settings()
