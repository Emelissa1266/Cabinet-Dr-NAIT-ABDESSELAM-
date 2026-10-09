from datetime import timedelta
from decimal import Decimal

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.accounts.models import User
from apps.billing.models import Invoice
from apps.documents.models import Document, DocumentCategory
from apps.medical.models import Consultation
from apps.patients.models import Patient
from apps.payments.models import Payment


def csrf_client():
    client = APIClient(enforce_csrf_checks=True)
    response = client.get("/api/v1/auth/csrf/")
    assert response.status_code == status.HTTP_200_OK
    csrf_token = response.cookies[settings.CSRF_COOKIE_NAME].value
    assert csrf_token
    return client, csrf_token


def login_with_cookie(user):
    client, csrf_token = csrf_client()
    response = client.post(
        "/api/v1/auth/login/",
        {"username": user.username, "password": "safe-test-password"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    return client, csrf_token, response


@pytest.mark.django_db
def test_valid_login_sets_httponly_cookies_and_returns_user_only(doctor_user):
    _, _, response = login_with_cookie(doctor_user)

    assert response.status_code == status.HTTP_200_OK
    assert "access" not in response.data
    assert "refresh" not in response.data
    assert response.data["user"]["id"] == doctor_user.id
    assert response.data["user"]["role"] == User.Role.DOCTOR
    assert response.data["user"]["professional_title"] == "Dermatologist"

    access_cookie = response.cookies[settings.AUTH_ACCESS_COOKIE_NAME]
    refresh_cookie = response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]
    assert access_cookie["httponly"]
    assert refresh_cookie["httponly"]
    assert access_cookie["path"] == settings.AUTH_ACCESS_COOKIE_PATH
    assert refresh_cookie["path"] == settings.AUTH_REFRESH_COOKIE_PATH
    assert access_cookie["samesite"] == settings.AUTH_COOKIE_SAMESITE
    assert refresh_cookie["samesite"] == settings.AUTH_COOKIE_SAMESITE


@pytest.mark.django_db
@override_settings(AUTH_COOKIE_SECURE=True, AUTH_COOKIE_SAMESITE="None")
def test_production_cookie_flags_are_secure(doctor_user):
    _, _, response = login_with_cookie(doctor_user)

    assert response.cookies[settings.AUTH_ACCESS_COOKIE_NAME]["secure"]
    assert response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]["secure"]
    assert response.cookies[settings.AUTH_ACCESS_COOKIE_NAME]["samesite"] == "None"
    assert response.cookies[settings.AUTH_REFRESH_COOKIE_NAME]["samesite"] == "None"


@pytest.mark.django_db
def test_invalid_login_is_rejected_without_tokens(doctor_user):
    client, csrf_token = csrf_client()

    response = client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "wrong-password"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "access" not in response.data
    assert settings.AUTH_ACCESS_COOKIE_NAME not in response.cookies
    assert settings.AUTH_REFRESH_COOKIE_NAME not in response.cookies


@pytest.mark.django_db
def test_cookie_access_token_authenticates_me_endpoint(nurse_user):
    client, _, login = login_with_cookie(nurse_user)
    assert login.status_code == status.HTTP_200_OK

    response = client.get("/api/v1/auth/me/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == nurse_user.id
    assert response.data["role"] == User.Role.NURSE


@pytest.mark.django_db
def test_legacy_authorization_header_without_cookie_is_rejected(api_client, nurse_user):
    access = str(RefreshToken.for_user(nurse_user).access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get("/api/v1/auth/me/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_malformed_and_expired_access_cookies_are_rejected(nurse_user):
    malformed_client = APIClient()
    malformed_client.cookies[settings.AUTH_ACCESS_COOKIE_NAME] = "not-a-jwt"
    malformed = malformed_client.get("/api/v1/auth/me/")

    expired_token = AccessToken.for_user(nurse_user)
    expired_token.set_exp(lifetime=-timedelta(seconds=1))
    expired_client = APIClient()
    expired_client.cookies[settings.AUTH_ACCESS_COOKIE_NAME] = str(expired_token)
    expired = expired_client.get("/api/v1/auth/me/")

    assert malformed.status_code == status.HTTP_401_UNAUTHORIZED
    assert expired.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_refresh_rotates_cookies_without_returning_tokens(secretary_user):
    client, csrf_token, login = login_with_cookie(secretary_user)
    assert login.status_code == status.HTTP_200_OK
    old_refresh = login.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value

    response = client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=csrf_token)

    assert response.status_code == status.HTTP_200_OK
    assert response.data is None
    assert response.cookies[settings.AUTH_ACCESS_COOKIE_NAME].value
    assert response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value
    assert response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value != old_refresh

    reuse_client, reuse_csrf_token = csrf_client()
    reuse_client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = old_refresh
    reuse = reuse_client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=reuse_csrf_token)

    assert reuse.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_expired_refresh_cookie_is_rejected_and_cleared(secretary_user):
    client, csrf_token = csrf_client()
    expired_refresh = RefreshToken.for_user(secretary_user)
    expired_refresh.set_exp(lifetime=-timedelta(seconds=1))
    client.cookies[settings.AUTH_REFRESH_COOKIE_NAME] = str(expired_refresh)

    response = client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=csrf_token)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.cookies[settings.AUTH_ACCESS_COOKIE_NAME].value == ""
    assert response.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value == ""


@pytest.mark.django_db
def test_logout_blacklists_refresh_token_and_clears_cookies(admin_user):
    client, csrf_token, login = login_with_cookie(admin_user)
    assert login.status_code == status.HTTP_200_OK

    logout = client.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=csrf_token)

    assert logout.status_code == status.HTTP_204_NO_CONTENT
    assert OutstandingToken.objects.count() == 1
    assert BlacklistedToken.objects.count() == 1
    assert logout.cookies[settings.AUTH_ACCESS_COOKIE_NAME].value == ""
    assert logout.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value == ""

    refresh_again = client.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=csrf_token)
    assert refresh_again.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_unauthenticated_me_is_rejected(api_client):
    response = api_client.get("/api/v1/auth/me/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_cookie_authenticated_unsafe_request_requires_csrf(doctor_user):
    client, csrf_token, login = login_with_cookie(doctor_user)
    assert login.status_code == status.HTTP_200_OK

    allowed = client.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=csrf_token)
    assert allowed.status_code == status.HTTP_204_NO_CONTENT

    blocked_client, _, blocked_login = login_with_cookie(doctor_user)
    assert blocked_login.status_code == status.HTTP_200_OK
    blocked = blocked_client.post("/api/v1/auth/logout/")
    assert blocked.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_login_requires_valid_csrf_token(doctor_user):
    client = APIClient(enforce_csrf_checks=True)

    missing = client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "safe-test-password"},
        format="json",
    )

    assert missing.status_code == status.HTTP_403_FORBIDDEN

    client, csrf_token = csrf_client()
    invalid = client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "safe-test-password"},
        format="json",
        HTTP_X_CSRFTOKEN=f"{csrf_token}-invalid",
    )

    assert invalid.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_login_origin_checks_reject_untrusted_and_allow_trusted_origin(doctor_user):
    trusted_client, trusted_csrf_token = csrf_client()
    trusted = trusted_client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "safe-test-password"},
        format="json",
        HTTP_X_CSRFTOKEN=trusted_csrf_token,
        HTTP_ORIGIN="http://localhost:3000",
    )

    untrusted_client, untrusted_csrf_token = csrf_client()
    untrusted = untrusted_client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "safe-test-password"},
        format="json",
        HTTP_X_CSRFTOKEN=untrusted_csrf_token,
        HTTP_ORIGIN="https://evil.example",
    )

    assert trusted.status_code == status.HTTP_200_OK
    assert untrusted.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_cookie_auth_csrf_blocks_sensitive_writes_without_database_changes(doctor_user, secretary_user):
    patient = Patient.objects.create(first_name="Csrf", last_name="Protected", created_by=secretary_user)
    category = DocumentCategory.objects.create(code="csrf-report", name="CSRF report", system_type="CLINICAL")

    doctor_client, _, doctor_login = login_with_cookie(doctor_user)
    secretary_client, _, secretary_login = login_with_cookie(secretary_user)
    assert doctor_login.status_code == status.HTTP_200_OK
    assert secretary_login.status_code == status.HTTP_200_OK

    consultation = doctor_client.post(
        "/api/v1/consultations/",
        {
            "patient": patient.id,
            "consultation_date": timezone.now().isoformat(),
            "consultation_type": "INITIAL",
            "reason": "CSRF probe",
            "status": "DRAFT",
        },
        format="json",
    )
    document = doctor_client.post(
        "/api/v1/documents/",
        {
            "patient": patient.id,
            "category": category.id,
            "title": "CSRF report",
            "file": SimpleUploadedFile("report.pdf", b"%PDF-1.4\ncsrf\n%%EOF", content_type="application/pdf"),
        },
        format="multipart",
    )
    invoice = secretary_client.post(
        "/api/v1/invoices/",
        {"patient": patient.id, "discount_amount": "0.00", "total": "1.00", "paid_amount": "1.00"},
        format="json",
    )
    payment = secretary_client.post(
        "/api/v1/payments/",
        {"patient": patient.id, "amount": Decimal("1000.00"), "payment_method": Payment.Method.CASH},
        format="json",
    )

    assert consultation.status_code == status.HTTP_403_FORBIDDEN
    assert document.status_code == status.HTTP_403_FORBIDDEN
    assert invoice.status_code == status.HTTP_403_FORBIDDEN
    assert payment.status_code == status.HTTP_403_FORBIDDEN
    assert Consultation.objects.count() == 0
    assert Document.objects.count() == 0
    assert Invoice.objects.count() == 0
    assert Payment.objects.count() == 0


@pytest.mark.django_db
def test_inactive_user_login_is_rejected(make_user):
    inactive_user = make_user(
        username="inactive-doctor",
        role=User.Role.DOCTOR,
        is_active=False,
    )
    client, csrf_token = csrf_client()

    response = client.post(
        "/api/v1/auth/login/",
        {"username": inactive_user.username, "password": "safe-test-password"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role", "username"),
    (
        (User.Role.ADMIN, "role-admin"),
        (User.Role.DOCTOR, "role-doctor"),
        (User.Role.NURSE, "role-nurse"),
        (User.Role.SECRETARY, "role-secretary"),
    ),
)
def test_supported_user_roles_are_persisted_and_returned(make_user, role, username):
    user = make_user(role=role, username=username)

    _, _, login = login_with_cookie(user)

    assert user.role == role
    assert login.status_code == status.HTTP_200_OK
    assert login.data["user"]["role"] == role
