from typing import ClassVar

from rest_framework.permissions import BasePermission

from .models import User


class IsActiveUser(BasePermission):
    message = "User account is inactive or unauthenticated."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)


class HasAnyRole(BasePermission):
    roles: ClassVar[frozenset[str]] = frozenset()

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role in self.roles
        )


class IsAdmin(HasAnyRole):
    roles = frozenset({User.Role.ADMIN})


class IsDoctor(HasAnyRole):
    roles = frozenset({User.Role.DOCTOR})


class IsNurse(HasAnyRole):
    roles = frozenset({User.Role.NURSE})


class IsSecretary(HasAnyRole):
    roles = frozenset({User.Role.SECRETARY})


class CanAccessClinicalPatientData(HasAnyRole):
    roles = frozenset({User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE})
