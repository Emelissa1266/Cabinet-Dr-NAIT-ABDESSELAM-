"""Base Django settings for the Clinic Management API."""

import os
from datetime import timedelta
from importlib.util import find_spec
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    return int(value)


SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "unsafe-development-secret-key-change-before-real-use",
)
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "apps.accounts",
    "apps.security",
    "apps.audit",
    "apps.patients",
    "apps.medical",
    "apps.care",
    "apps.surgery",
    "apps.agenda",
    "apps.billing",
    "apps.payments",
    "apps.documents",
    "apps.notifications",
    "apps.dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.security.middleware.SecurityHeadersMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=env_int("DB_CONN_MAX_AGE", 600),
            ssl_require=env_bool("DB_SSL_REQUIRE", False),
        )
    }
elif os.getenv("DB_NAME"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME"),
            "USER": os.getenv("DB_USER"),
            "PASSWORD": os.getenv("DB_PASSWORD"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }
else:
    # Local bootstrap fallback only. Use DATABASE_URL or DB_* for PostgreSQL/Supabase.
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Africa/Algiers")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
_private_media_root = Path(os.getenv("PRIVATE_MEDIA_ROOT", "private_media"))
PRIVATE_MEDIA_ROOT = _private_media_root if _private_media_root.is_absolute() else BASE_DIR / _private_media_root
DOCUMENT_MAX_UPLOAD_SIZE = env_int("DOCUMENT_MAX_UPLOAD_SIZE", 10 * 1024 * 1024)
CLINICAL_PHOTO_MAX_UPLOAD_SIZE = env_int("CLINICAL_PHOTO_MAX_UPLOAD_SIZE", 15 * 1024 * 1024)
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DEFAULT_CURRENCY = os.getenv("DEFAULT_CURRENCY", "DZD")
APPOINTMENT_REMINDER_HOURS = env_int("APPOINTMENT_REMINDER_HOURS", 24)
SURGERY_REMINDER_HOURS = env_int("SURGERY_REMINDER_HOURS", 48)
PREOP_ALERT_HOURS = env_int("PREOP_ALERT_HOURS", 48)
DASHBOARD_UPCOMING_DAYS = env_int("DASHBOARD_UPCOMING_DAYS", 7)
DASHBOARD_PREVIEW_LIMIT = env_int("DASHBOARD_PREVIEW_LIMIT", 5)

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
CORS_ALLOW_CREDENTIALS = True
CSRF_COOKIE_NAME = os.getenv("CSRF_COOKIE_NAME", "clinic_csrftoken")
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", False)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)
AUTH_ACCESS_COOKIE_NAME = os.getenv("AUTH_ACCESS_COOKIE_NAME", "clinic_access")
AUTH_REFRESH_COOKIE_NAME = os.getenv("AUTH_REFRESH_COOKIE_NAME", "clinic_refresh")
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN") or None
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax")
AUTH_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", False)
AUTH_ACCESS_COOKIE_PATH = os.getenv("AUTH_ACCESS_COOKIE_PATH", "/api/v1/")
AUTH_REFRESH_COOKIE_PATH = os.getenv("AUTH_REFRESH_COOKIE_PATH", "/api/v1/auth/")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "same-origin")
X_FRAME_OPTIONS = os.getenv("X_FRAME_OPTIONS", "DENY")
SECURITY_PERMISSIONS_POLICY = os.getenv(
    "SECURITY_PERMISSIONS_POLICY",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)",
)
SECURITY_CSP_REPORT_ONLY = env_bool("SECURITY_CSP_REPORT_ONLY", False)
SECURITY_CSP_REPORT_ONLY_POLICY = os.getenv(
    "SECURITY_CSP_REPORT_ONLY_POLICY",
    "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "apps.security.throttling.AuthenticatedApiThrottle",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": env_int("DRF_PAGE_SIZE", 20),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.security.exceptions.clinic_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env_int("JWT_ACCESS_LIFETIME", 30)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        minutes=env_int("JWT_REFRESH_LIFETIME", 60 * 24 * 7)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Clinic Management API",
    "DESCRIPTION": "Backend API for the Clinic Management project.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
}

DATA_UPLOAD_MAX_MEMORY_SIZE = env_int("DATA_UPLOAD_MAX_MEMORY_SIZE", 5 * 1024 * 1024)
FILE_UPLOAD_MAX_MEMORY_SIZE = env_int("FILE_UPLOAD_MAX_MEMORY_SIZE", 5 * 1024 * 1024)

CACHES = {
    "default": {
        "BACKEND": os.getenv("DJANGO_CACHE_BACKEND", "django.core.cache.backends.locmem.LocMemCache"),
        "LOCATION": os.getenv("DJANGO_CACHE_LOCATION", "clinic-dev-cache"),
    }
}

RATE_LIMIT_REDIS_URL = os.getenv("RATE_LIMIT_REDIS_URL")
if RATE_LIMIT_REDIS_URL:
    if find_spec("django_redis") is None:
        raise ImproperlyConfigured("RATE_LIMIT_REDIS_URL requires django-redis to be installed.")
    CACHES["rate_limit"] = {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": RATE_LIMIT_REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }

RATE_LIMIT_CACHE_ALIAS = os.getenv(
    "RATE_LIMIT_CACHE_ALIAS",
    "rate_limit" if RATE_LIMIT_REDIS_URL else "default",
)
RATE_LIMIT_REQUIRE_SHARED_CACHE = env_bool("RATE_LIMIT_REQUIRE_SHARED_CACHE", False)
TRUSTED_PROXY_IPS = env_list("TRUSTED_PROXY_IPS")
RATE_LIMIT_THROTTLED_MESSAGE = os.getenv(
    "RATE_LIMIT_THROTTLED_MESSAGE",
    "Trop de tentatives. Veuillez réessayer plus tard.",
)
RATE_LIMIT_POLICIES = {
    "auth_login_ip": {
        "rate": os.getenv("RATE_LIMIT_AUTH_LOGIN_IP", "10/min"),
        "critical": True,
    },
    "auth_login_account": {
        "rate": os.getenv("RATE_LIMIT_AUTH_LOGIN_ACCOUNT", "5/5min"),
        "critical": True,
    },
    "auth_login_global": {
        "rate": os.getenv("RATE_LIMIT_AUTH_LOGIN_GLOBAL", "120/min"),
        "critical": True,
    },
    "auth_refresh": {
        "rate": os.getenv("RATE_LIMIT_AUTH_REFRESH", "30/min"),
        "critical": True,
    },
    "auth_csrf": {
        "rate": os.getenv("RATE_LIMIT_AUTH_CSRF", "60/min"),
        "critical": False,
    },
    "auth_session": {
        "rate": os.getenv("RATE_LIMIT_AUTH_SESSION", "120/min"),
        "critical": False,
    },
    "api_general": {
        "rate": os.getenv("RATE_LIMIT_API_GENERAL", "1000/min"),
        "critical": False,
    },
    "sensitive_write": {
        "rate": os.getenv("RATE_LIMIT_SENSITIVE_WRITE", "120/min"),
        "critical": False,
    },
    "expensive_search": {
        "rate": os.getenv("RATE_LIMIT_EXPENSIVE_SEARCH", "120/min"),
        "critical": False,
    },
    "file_upload": {
        "rate": os.getenv("RATE_LIMIT_FILE_UPLOAD", "30/min"),
        "critical": False,
    },
    "private_download": {
        "rate": os.getenv("RATE_LIMIT_PRIVATE_DOWNLOAD", "120/min"),
        "critical": False,
    },
    "pdf_generation": {
        "rate": os.getenv("RATE_LIMIT_PDF_GENERATION", "30/min"),
        "critical": False,
    },
}
