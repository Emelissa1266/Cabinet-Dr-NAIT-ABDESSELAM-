from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import User

FINANCIAL_READ_ROLES = {User.Role.ADMIN, User.Role.SECRETARY, User.Role.DOCTOR, User.Role.NURSE}
FINANCIAL_WRITE_ROLES = {User.Role.ADMIN, User.Role.SECRETARY}


class FinancialPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in FINANCIAL_READ_ROLES
        return user.role in FINANCIAL_WRITE_ROLES


class BillableServicePermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in FINANCIAL_READ_ROLES
        return user.role == User.Role.ADMIN
