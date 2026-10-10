import pytest
from django.conf import settings as django_settings
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from apps.billing.models import Invoice
from apps.documents.models import Document, DocumentCategory
from apps.patients.models import Patient

pytestmark = pytest.mark.django_db


TEST_POLICIES = {
    "auth_login_ip": {"rate": "2/min", "critical": True},
    "auth_login_account": {"rate": "2/min", "critical": True},
    "auth_login_global": {"rate": "100/min", "critical": True},
    "auth_refresh": {"rate": "2/min", "critical": True},
    "auth_csrf": {"rate": "3/min", "critical": False},
    "auth_session": {"rate": "3/min", "critical": False},
    "api_general": {"rate": "100/min", "critical": False},
    "sensitive_write": {"rate": "1/min", "critical": False},
    "expensive_search": {"rate": "1/min", "critical": False},
    "file_upload": {"rate": "1/min", "critical": False},
    "private_download": {"rate": "1/min", "critical": False},
    "pdf_generation": {"rate": "1/min", "critical": False},
}


@pytest.fixture(autouse=True)
def rate_limit_settings(settings):
    settings.DEBUG = True
    settings.RATE_LIMIT_REQUIRE_SHARED_CACHE = False
    settings.RATE_LIMIT_CACHE_ALIAS = "default"
    settings.RATE_LIMIT_POLICIES = TEST_POLICIES.copy()
    settings.TRUSTED_PROXY_IPS = []
    cache.clear()
    yield
    cache.clear()


def csrf_client(remote_addr="127.0.0.1"):
    client = APIClient(enforce_csrf_checks=True)
    response = client.get("/api/v1/auth/csrf/", REMOTE_ADDR=remote_addr)
    assert response.status_code == status.HTTP_200_OK
    token = response.cookies[django_settings.CSRF_COOKIE_NAME].value
    return client, token


def login_request(client, token, username, password="bad-password", remote_addr="127.0.0.1", **headers):
    return client.post(
        "/api/v1/auth/login/",
        {"username": username, "password": password},
        format="json",
        HTTP_X_CSRFTOKEN=token,
        REMOTE_ADDR=remote_addr,
        **headers,
    )


def assert_rate_limited(response):
    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert response.data == {"detail": django_settings.RATE_LIMIT_THROTTLED_MESSAGE}
    assert int(response["Retry-After"]) > 0


def document_file(name="rate-limit.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4\nrate-limit\n%%EOF", content_type="application/pdf")


def make_patient(doctor_user, first_name="Rate", last_name="Limited"):
    return Patient.objects.create(first_name=first_name, last_name=last_name, created_by=doctor_user)


def test_login_within_limit_and_all_roles_can_authenticate(make_user):
    for index, role in enumerate(("ADMIN", "DOCTOR", "NURSE", "SECRETARY")):
        user = make_user(role=role, username=f"role-{role.lower()}")
        client, token = csrf_client(remote_addr=f"10.20.0.{index}")

        response = login_request(
            client,
            token,
            user.username,
            password="safe-test-password",
            remote_addr=f"10.20.0.{index}",
        )
        me = client.get("/api/v1/auth/me/", REMOTE_ADDR=f"10.20.0.{index}")
        logout = client.post(
            "/api/v1/auth/logout/",
            HTTP_X_CSRFTOKEN=token,
            REMOTE_ADDR=f"10.20.0.{index}",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["user"]["role"] == role
        assert me.status_code == status.HTTP_200_OK
        assert logout.status_code == status.HTTP_204_NO_CONTENT


def test_login_ip_limit_uses_remote_addr_and_returns_429_without_token_leakage():
    client, token = csrf_client(remote_addr="10.0.0.10")

    assert login_request(client, token, "unknown-a", remote_addr="10.0.0.10").status_code == status.HTTP_401_UNAUTHORIZED
    assert login_request(client, token, "unknown-b", remote_addr="10.0.0.10").status_code == status.HTTP_401_UNAUTHORIZED
    limited = login_request(client, token, "unknown-c", remote_addr="10.0.0.10")

    assert_rate_limited(limited)
    assert "access" not in limited.data
    assert "refresh" not in limited.data


def test_login_account_failed_attempt_limit_does_not_reveal_known_accounts(doctor_user):
    for index in range(2):
        client, token = csrf_client(remote_addr=f"10.0.1.{index}")
        response = login_request(client, token, doctor_user.username, remote_addr=f"10.0.1.{index}")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    client, token = csrf_client(remote_addr="10.0.1.99")
    limited = login_request(client, token, doctor_user.username, remote_addr="10.0.1.99")
    assert_rate_limited(limited)

    client, token = csrf_client(remote_addr="10.0.2.99")
    unknown = login_request(client, token, "not-a-real-account", remote_addr="10.0.2.99")
    assert unknown.status_code == status.HTTP_401_UNAUTHORIZED


def test_valid_login_after_account_cooldown(monkeypatch, settings, doctor_user):
    settings.RATE_LIMIT_POLICIES = {**TEST_POLICIES, "auth_login_account": {"rate": "2/s", "critical": True}}
    from apps.security import throttling

    now = 1000.0
    monkeypatch.setattr(throttling.time, "time", lambda: now)

    for index in range(2):
        client, token = csrf_client(remote_addr=f"10.0.3.{index}")
        assert login_request(client, token, doctor_user.username, remote_addr=f"10.0.3.{index}").status_code == 401

    client, token = csrf_client(remote_addr="10.0.3.50")
    assert_rate_limited(login_request(client, token, doctor_user.username, remote_addr="10.0.3.50"))

    now = 1001.1
    client, token = csrf_client(remote_addr="10.0.3.51")
    recovered = login_request(
        client,
        token,
        doctor_user.username,
        password="safe-test-password",
        remote_addr="10.0.3.51",
    )
    assert recovered.status_code == status.HTTP_200_OK


def test_concurrent_login_attempts_hit_ip_limit():
    client, token = csrf_client(remote_addr="10.0.4.10")
    responses = [
        login_request(client, token, f"parallel-{index}", remote_addr="10.0.4.10")
        for index in range(4)
    ]

    assert [response.status_code for response in responses].count(status.HTTP_429_TOO_MANY_REQUESTS) >= 2


def test_refresh_limit_and_logout_still_work(secretary_user):
    client, token = csrf_client(remote_addr="10.0.5.10")
    assert login_request(
        client,
        token,
        secretary_user.username,
        password="safe-test-password",
        remote_addr="10.0.5.10",
    ).status_code == status.HTTP_200_OK

    assert client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=token, REMOTE_ADDR="10.0.5.10").status_code == 200
    assert client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=token, REMOTE_ADDR="10.0.5.10").status_code == 200
    assert_rate_limited(client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=token, REMOTE_ADDR="10.0.5.10"))


def test_csrf_bootstrap_has_its_own_reasonable_limit():
    client = APIClient(enforce_csrf_checks=True)
    for _ in range(3):
        assert client.get("/api/v1/auth/csrf/", REMOTE_ADDR="10.0.6.10").status_code == status.HTTP_200_OK

    assert_rate_limited(client.get("/api/v1/auth/csrf/", REMOTE_ADDR="10.0.6.10"))


def test_authenticated_general_api_limit(settings, api_client, doctor_user):
    settings.RATE_LIMIT_POLICIES = {**TEST_POLICIES, "api_general": {"rate": "1/min", "critical": False}}
    api_client.force_authenticate(user=doctor_user)

    assert api_client.get("/api/v1/patients/", REMOTE_ADDR="10.0.7.10").status_code == status.HTTP_200_OK
    assert_rate_limited(api_client.get("/api/v1/patients/", REMOTE_ADDR="10.0.7.10"))


def test_sensitive_write_limit_blocks_database_mutation(api_client, doctor_user, patient_payload):
    api_client.force_authenticate(user=doctor_user)

    created = api_client.post("/api/v1/patients/", patient_payload, format="json", REMOTE_ADDR="10.0.8.10")
    second = api_client.post(
        "/api/v1/patients/",
        {**patient_payload, "first_name": "Second", "email": "second@example.com"},
        format="json",
        REMOTE_ADDR="10.0.8.10",
    )

    assert created.status_code == status.HTTP_201_CREATED
    assert_rate_limited(second)
    assert Patient.objects.filter(email="second@example.com").count() == 0


def test_file_upload_limit_blocks_second_document(api_client, doctor_user):
    patient = make_patient(doctor_user)
    category = DocumentCategory.objects.create(code="rl-doc", name="Rate doc")
    api_client.force_authenticate(user=doctor_user)

    first = api_client.post(
        "/api/v1/documents/",
        {"patient": patient.id, "category": category.id, "title": "First", "file": document_file("first.pdf")},
        format="multipart",
        REMOTE_ADDR="10.0.9.10",
    )
    second = api_client.post(
        "/api/v1/documents/",
        {"patient": patient.id, "category": category.id, "title": "Second", "file": document_file("second.pdf")},
        format="multipart",
        REMOTE_ADDR="10.0.9.10",
    )

    assert first.status_code == status.HTTP_201_CREATED
    assert_rate_limited(second)
    assert Document.objects.filter(title="Second").count() == 0


def test_private_download_limit(api_client, doctor_user):
    patient = make_patient(doctor_user)
    category = DocumentCategory.objects.create(code="rl-download", name="Rate download")
    document = Document.objects.create(
        patient=patient,
        category=category,
        title="Private file",
        file=document_file(),
        original_filename="rate-limit.pdf",
        mime_type="application/pdf",
        file_size=32,
        checksum="0" * 64,
        uploaded_by=doctor_user,
    )
    api_client.force_authenticate(user=doctor_user)

    assert api_client.get(f"/api/v1/documents/{document.id}/download/", REMOTE_ADDR="10.0.10.10").status_code == 200
    assert_rate_limited(api_client.get(f"/api/v1/documents/{document.id}/download/", REMOTE_ADDR="10.0.10.10"))


def test_pdf_generation_limit(api_client, secretary_user, doctor_user):
    patient = make_patient(doctor_user)
    invoice = Invoice.objects.create(patient=patient, created_by=secretary_user)
    api_client.force_authenticate(user=secretary_user)

    assert api_client.get(f"/api/v1/invoices/{invoice.id}/pdf/", REMOTE_ADDR="10.0.11.10").status_code == 200
    assert_rate_limited(api_client.get(f"/api/v1/invoices/{invoice.id}/pdf/", REMOTE_ADDR="10.0.11.10"))


def test_untrusted_forwarded_for_cannot_evade_login_ip_limit():
    client, token = csrf_client(remote_addr="10.0.12.10")

    first = login_request(
        client,
        token,
        "xff-one",
        remote_addr="10.0.12.10",
        HTTP_X_FORWARDED_FOR="198.51.100.1",
    )
    second = login_request(
        client,
        token,
        "xff-two",
        remote_addr="10.0.12.10",
        HTTP_X_FORWARDED_FOR="198.51.100.2",
    )
    limited = login_request(
        client,
        token,
        "xff-three",
        remote_addr="10.0.12.10",
        HTTP_X_FORWARDED_FOR="198.51.100.3",
    )

    assert first.status_code == status.HTTP_401_UNAUTHORIZED
    assert second.status_code == status.HTTP_401_UNAUTHORIZED
    assert_rate_limited(limited)


def test_trusted_proxy_uses_forwarded_client_ip(settings):
    settings.TRUSTED_PROXY_IPS = ["10.0.13.1"]
    client, token = csrf_client(remote_addr="10.0.13.1")

    for index in range(3):
        response = login_request(
            client,
            token,
            f"trusted-xff-{index}",
            remote_addr="10.0.13.1",
            HTTP_X_FORWARDED_FOR=f"198.51.100.{index}",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_critical_auth_limiter_fails_closed_when_cache_unavailable(monkeypatch):
    backend_cache = cache

    def broken_add(*args, **kwargs):
        raise RuntimeError("cache unavailable")

    monkeypatch.setattr(backend_cache, "add", broken_add)
    client, token = csrf_client(remote_addr="10.0.14.10")

    assert_rate_limited(login_request(client, token, "cache-down", remote_addr="10.0.14.10"))


def test_noncritical_endpoint_limiter_fails_open_when_cache_unavailable(monkeypatch, api_client, doctor_user):
    backend_cache = cache

    def broken_add(*args, **kwargs):
        raise RuntimeError("cache unavailable")

    monkeypatch.setattr(backend_cache, "add", broken_add)
    api_client.force_authenticate(user=doctor_user)

    response = api_client.get("/api/v1/patients/?search=anything", REMOTE_ADDR="10.0.15.10")

    assert response.status_code == status.HTTP_200_OK


def test_production_critical_limiter_rejects_local_memory_cache(settings):
    settings.RATE_LIMIT_REQUIRE_SHARED_CACHE = True
    client, token = csrf_client(remote_addr="10.0.16.10")

    with pytest.raises(Exception, match="Critical rate limiting requires a shared production cache"):
        login_request(client, token, "prod-cache", remote_addr="10.0.16.10")
