from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import User


class SurgeryPermission(BasePermission):
    message = "You do not have permission to perform this surgery action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}
        return user.role == User.Role.DOCTOR


class SurgeryConfigurationPermission(BasePermission):
    message = "You do not have permission to manage surgery configuration."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}
        return user.role in {User.Role.ADMIN, User.Role.DOCTOR}


class InterventionTypePermission(BasePermission):
    message = "You do not have permission to manage intervention types."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}
        return user.role == User.Role.ADMIN


class DoctorOnlySurgeryPermission(BasePermission):
    message = "Only doctors can perform this clinical surgery action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role == User.Role.DOCTOR
        )


class PreoperativeExecutionPermission(BasePermission):
    message = "You do not have permission to update pre-operative execution data."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE}
        return user.role in {User.Role.DOCTOR, User.Role.NURSE}


class SurgicalReadPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}
        )
