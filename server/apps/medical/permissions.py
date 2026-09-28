from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import User


class MedicalReadDoctorWritePermission(BasePermission):
    message = "You do not have permission to perform this medical action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE}
        return user.role == User.Role.DOCTOR
