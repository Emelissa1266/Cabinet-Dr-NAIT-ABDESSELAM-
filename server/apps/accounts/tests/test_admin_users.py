import pytest
from django.contrib.auth.hashers import check_password
from rest_framework import status

from apps.accounts.models import User
from apps.audit.models import AuditLog


@pytest.mark.django_db
def test_admin_user_management_create_update_deactivate_and_login_rejection(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    create = api_client.post(
        "/api/v1/auth/users/",
        {
            "username": "phase9k-doctor",
            "first_name": "Phase",
            "last_name": "Doctor",
            "email": "phase9k-doctor@example.com",
            "phone": "+213555000001",
            "role": User.Role.DOCTOR,
            "professional_title": "Chirurgien",
            "password": "temporary-safe-password",
            "is_active": True,
        },
        format="json",
    )

    assert create.status_code == status.HTTP_201_CREATED
    assert create.data["role"] == User.Role.DOCTOR
    assert create.data["is_active"] is True
    assert "password" not in create.data
    user = User.objects.get(username="phase9k-doctor")
    assert user.password != "temporary-safe-password"
    assert check_password("temporary-safe-password", user.password)
    assert AuditLog.objects.filter(action="ADMIN_USER_CREATED", entity_id=str(user.id)).exists()

    api_client.force_authenticate(user=None)
    login = api_client.post(
        "/api/v1/auth/login/",
        {"username": "phase9k-doctor", "password": "temporary-safe-password"},
        format="json",
    )
    assert login.status_code == status.HTTP_200_OK

    api_client.force_authenticate(user=admin_user)
    update = api_client.patch(
        f"/api/v1/auth/users/{user.id}/",
        {"first_name": "Updated", "role": User.Role.NURSE, "is_active": False},
        format="json",
    )

    assert update.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    assert user.first_name == "Updated"
    assert user.role == User.Role.NURSE
    assert user.is_active is False
    assert AuditLog.objects.filter(action="ADMIN_USER_ACTIVATION_CHANGED", entity_id=str(user.id)).exists()

    api_client.force_authenticate(user=None)
    rejected = api_client.post(
        "/api/v1/auth/login/",
        {"username": "phase9k-doctor", "password": "temporary-safe-password"},
        format="json",
    )
    assert rejected.status_code == status.HTTP_401_UNAUTHORIZED
    assert User.objects.filter(pk=user.pk).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("role", [User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY])
def test_admin_user_management_is_admin_only(api_client, make_user, role):
    actor = make_user(role=role, username=f"not-admin-{role.lower()}")
    api_client.force_authenticate(user=actor)

    response = api_client.post(
        "/api/v1/auth/users/",
        {
            "username": f"blocked-{role.lower()}",
            "email": f"blocked-{role.lower()}@example.com",
            "role": User.Role.DOCTOR,
            "password": "temporary-safe-password",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert not User.objects.filter(username=f"blocked-{role.lower()}").exists()


@pytest.mark.django_db
def test_admin_user_management_self_and_last_admin_protection(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    deactivate_self = api_client.patch(
        f"/api/v1/auth/users/{admin_user.id}/",
        {"is_active": False},
        format="json",
    )
    remove_own_role = api_client.patch(
        f"/api/v1/auth/users/{admin_user.id}/",
        {"role": User.Role.DOCTOR},
        format="json",
    )

    assert deactivate_self.status_code == status.HTTP_400_BAD_REQUEST
    assert remove_own_role.status_code == status.HTTP_400_BAD_REQUEST
    admin_user.refresh_from_db()
    assert admin_user.role == User.Role.ADMIN
    assert admin_user.is_active is True

    second_admin = User.objects.create_user(
        username="second-admin",
        email="second-admin@example.com",
        password="temporary-safe-password",
        role=User.Role.ADMIN,
    )
    demote_other = api_client.patch(
        f"/api/v1/auth/users/{second_admin.id}/",
        {"role": User.Role.SECRETARY},
        format="json",
    )
    assert demote_other.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_admin_user_management_does_not_delete_users(api_client, admin_user, doctor_user):
    api_client.force_authenticate(user=admin_user)

    response = api_client.delete(f"/api/v1/auth/users/{doctor_user.id}/")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    assert User.objects.filter(pk=doctor_user.pk).exists()
