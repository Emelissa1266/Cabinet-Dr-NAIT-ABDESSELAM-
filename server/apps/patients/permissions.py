from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import User


class PatientPermission(BasePermission):
    message = "You do not have permission to perform this patient action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False

        if user.role == User.Role.ADMIN:
            return True

        if request.method in SAFE_METHODS:
            return user.role in {
                User.Role.DOCTOR,
                User.Role.NURSE,
                User.Role.SECRETARY,
            }

        if request.method == "DELETE":
            return user.role == User.Role.DOCTOR

        return user.role in {
            User.Role.DOCTOR,
            User.Role.NURSE,
            User.Role.SECRETARY,
        }

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class MedicalAlertPermission(BasePermission):
    message = "You do not have permission to perform this medical alert action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE}
        return user.role == User.Role.DOCTOR

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)
