from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import User


class AgendaPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}


class AgendaConfigPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}
        return user.role == User.Role.ADMIN
