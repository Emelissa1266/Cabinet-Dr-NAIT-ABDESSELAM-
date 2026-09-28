import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user(db):
    def _make_user(role=User.Role.DOCTOR, **kwargs):
        username = kwargs.pop("username", role.lower())
        email = kwargs.pop("email", f"{username}@example.com")
        password = kwargs.pop("password", "safe-test-password")
        return User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            **kwargs,
        )

    return _make_user


@pytest.fixture
def admin_user(make_user):
    return make_user(
        role=User.Role.ADMIN,
        username="admin",
        first_name="Admin",
        last_name="Clinic",
        professional_title="Administrator",
    )


@pytest.fixture
def doctor_user(make_user):
    return make_user(
        role=User.Role.DOCTOR,
        username="doctor",
        first_name="Gaya",
        last_name="Doctor",
        professional_title="Dermatologist",
    )


@pytest.fixture
def nurse_user(make_user):
    return make_user(
        role=User.Role.NURSE,
        username="nurse",
        first_name="Nadia",
        last_name="Nurse",
        professional_title="Nurse",
    )


@pytest.fixture
def secretary_user(make_user):
    return make_user(
        role=User.Role.SECRETARY,
        username="secretary",
        first_name="Sara",
        last_name="Secretary",
        professional_title="Secretary",
    )


@pytest.fixture
def patient_payload():
    return {
        "first_name": "Sarah",
        "last_name": "Benali",
        "date_of_birth": "1990-04-12",
        "gender": "FEMALE",
        "phone": "+213555111222",
        "email": "sarah@example.com",
        "address": "12 Rue Didouche",
        "city": "Algiers",
        "emergency_contact": "Karim Benali",
        "emergency_phone": "+213555333444",
        "profession": "Architect",
        "notes": "Administrative note",
        "is_active": True,
    }


@pytest.fixture
def auth_client(api_client):
    def _auth_client(user):
        api_client.force_authenticate(user=user)
        return api_client

    return _auth_client
