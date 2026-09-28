import pytest
from rest_framework import status
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.accounts.models import User


@pytest.mark.django_db
def test_valid_login_returns_tokens_and_user_role(api_client, doctor_user):
    response = api_client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "safe-test-password"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["access"]
    assert response.data["refresh"]
    assert response.data["user"]["id"] == doctor_user.id
    assert response.data["user"]["role"] == User.Role.DOCTOR
    assert response.data["user"]["professional_title"] == "Dermatologist"


@pytest.mark.django_db
def test_invalid_login_is_rejected(api_client, doctor_user):
    response = api_client.post(
        "/api/v1/auth/login/",
        {"username": doctor_user.username, "password": "wrong-password"},
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "access" not in response.data


@pytest.mark.django_db
def test_jwt_access_token_authenticates_me_endpoint(api_client, nurse_user):
    login = api_client.post(
        "/api/v1/auth/login/",
        {"username": nurse_user.username, "password": "safe-test-password"},
        format="json",
    )

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    response = api_client.get("/api/v1/auth/me/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == nurse_user.id
    assert response.data["role"] == User.Role.NURSE


@pytest.mark.django_db
def test_jwt_refresh_returns_new_access_token(api_client, secretary_user):
    login = api_client.post(
        "/api/v1/auth/login/",
        {"username": secretary_user.username, "password": "safe-test-password"},
        format="json",
    )

    response = api_client.post(
        "/api/v1/auth/refresh/",
        {"refresh": login.data["refresh"]},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["access"]


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(api_client, admin_user):
    login = api_client.post(
        "/api/v1/auth/login/",
        {"username": admin_user.username, "password": "safe-test-password"},
        format="json",
    )
    refresh = login.data["refresh"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    logout = api_client.post("/api/v1/auth/logout/", {"refresh": refresh}, format="json")

    assert logout.status_code == status.HTTP_204_NO_CONTENT
    assert OutstandingToken.objects.count() == 1
    assert BlacklistedToken.objects.count() == 1

    refresh_again = api_client.post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json")
    assert refresh_again.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_unauthenticated_me_is_rejected(api_client):
    response = api_client.get("/api/v1/auth/me/")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_inactive_user_login_is_rejected(api_client, make_user):
    inactive_user = make_user(
        username="inactive-doctor",
        role=User.Role.DOCTOR,
        is_active=False,
    )

    response = api_client.post(
        "/api/v1/auth/login/",
        {"username": inactive_user.username, "password": "safe-test-password"},
        format="json",
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
def test_supported_user_roles_are_persisted_and_returned(api_client, make_user, role, username):
    user = make_user(role=role, username=username)

    login = api_client.post(
        "/api/v1/auth/login/",
        {"username": username, "password": "safe-test-password"},
        format="json",
    )

    assert user.role == role
    assert login.status_code == status.HTTP_200_OK
    assert login.data["user"]["role"] == role
