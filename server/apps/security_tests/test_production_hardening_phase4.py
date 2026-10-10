import pytest
from django.core.exceptions import ImproperlyConfigured
from rest_framework import status

from config.settings.validators import validate_production_security_settings


def safe_production_settings(**overrides):
    values = {
        "secret_key": "production-secret-value-with-enough-entropy",
        "allowed_hosts": ["clinic.example.test"],
        "auth_cookie_secure": True,
        "csrf_cookie_secure": True,
        "session_cookie_secure": True,
        "rate_limit_require_shared_cache": True,
        "rate_limit_cache_backend": "django.core.cache.backends.filebased.FileBasedCache",
        "database_engine": "django.db.backends.postgresql",
        "secure_proxy_ssl_header_enabled": False,
        "trusted_proxy_ips": [],
        "hsts_preload": False,
        "hsts_include_subdomains": False,
        "hsts_seconds": 31536000,
    }
    values.update(overrides)
    return values


def test_safe_production_security_settings_validate():
    validate_production_security_settings(**safe_production_settings())


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"secret_key": "unsafe-development-secret-key-change-before-real-use"}, "SECRET_KEY"),
        ({"allowed_hosts": ["*"]}, "ALLOWED_HOSTS"),
        ({"allowed_hosts": ["localhost"]}, "ALLOWED_HOSTS"),
        ({"auth_cookie_secure": False}, "cookies"),
        ({"csrf_cookie_secure": False}, "cookies"),
        ({"session_cookie_secure": False}, "cookies"),
        (
            {"rate_limit_cache_backend": "django.core.cache.backends.locmem.LocMemCache"},
            "shared cache",
        ),
        ({"database_engine": "django.db.backends.sqlite3"}, "PostgreSQL"),
        ({"secure_proxy_ssl_header_enabled": True}, "TRUSTED_PROXY_IPS"),
        (
            {
                "hsts_preload": True,
                "hsts_include_subdomains": False,
                "hsts_seconds": 31536000,
            },
            "HSTS preload",
        ),
    ],
)
def test_unsafe_production_security_settings_fail(override, message):
    with pytest.raises(ImproperlyConfigured, match=message):
        validate_production_security_settings(**safe_production_settings(**override))


@pytest.mark.django_db
def test_api_documentation_requires_admin_role(api_client, doctor_user, admin_user):
    anonymous = api_client.get("/api/schema/")
    assert anonymous.status_code == status.HTTP_401_UNAUTHORIZED

    api_client.force_authenticate(user=doctor_user)
    doctor = api_client.get("/api/schema/")
    assert doctor.status_code == status.HTTP_403_FORBIDDEN

    api_client.force_authenticate(user=admin_user)
    admin = api_client.get("/api/schema/")
    assert admin.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_sensitive_api_responses_are_no_store(api_client, doctor_user):
    api_client.force_authenticate(user=doctor_user)
    response = api_client.get("/api/v1/patients/")

    assert response.status_code == status.HTTP_200_OK
    assert response["Cache-Control"] == "no-store, private"
    assert response["Pragma"] == "no-cache"
    assert "Permissions-Policy" in response


@pytest.mark.django_db
def test_health_check_remains_public_without_sensitive_cache_header(api_client):
    response = api_client.get("/api/v1/health/")

    assert response.status_code == status.HTTP_200_OK
    assert "Cache-Control" not in response
