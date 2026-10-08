from django.db.models import Q
from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import User

from .models import DocumentCategory


def nurse_care_patient_query(user) -> Q:
    return (
        Q(patient__cares__assigned_nurse=user)
        | Q(patient__cares__prescribed_by=user)
        | Q(patient__cares__sessions__nurse=user)
    )


def filter_nurse_care_relevant_patients(queryset, user):
    return queryset.filter(nurse_care_patient_query(user)).distinct()


def is_patient_care_relevant(user, patient_id) -> bool:
    if not patient_id:
        return False
    from apps.care.models import Care

    return (
        Care.objects.filter(patient_id=patient_id)
        .filter(Q(assigned_nurse=user) | Q(prescribed_by=user) | Q(sessions__nurse=user))
        .exists()
    )


def is_care_relevant(user, obj) -> bool:
    care = getattr(obj, "care", None)
    if care and (care.assigned_nurse_id == user.id or care.prescribed_by_id == user.id):
        return True
    care_session = getattr(obj, "care_session", None)
    return bool(care_session and care_session.nurse_id == user.id)


class DocumentCategoryPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}
        return user.role == User.Role.ADMIN


class DocumentPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}
        return user.role in {User.Role.DOCTOR, User.Role.NURSE, User.Role.SECRETARY}

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in {User.Role.ADMIN, User.Role.DOCTOR}:
            return True
        if user.role == User.Role.SECRETARY:
            if request.method not in SAFE_METHODS and getattr(view, "action", "") != "archive":
                return obj.category.system_type in {
                    DocumentCategory.SystemType.ADMINISTRATIVE,
                    DocumentCategory.SystemType.CONSENT,
                }
            return obj.category.system_type in {
                DocumentCategory.SystemType.ADMINISTRATIVE,
                DocumentCategory.SystemType.CONSENT,
            }
        if user.role == User.Role.NURSE:
            if request.method not in SAFE_METHODS and getattr(view, "action", "") != "archive":
                return is_care_relevant(user, obj)
            return is_care_relevant(user, obj)
        return False


class ClinicalPhotoPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method in SAFE_METHODS:
            return user.role in {User.Role.ADMIN, User.Role.DOCTOR, User.Role.NURSE}
        return user.role in {User.Role.DOCTOR, User.Role.NURSE}

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in {User.Role.ADMIN, User.Role.DOCTOR}:
            return True
        if user.role == User.Role.NURSE:
            return is_patient_care_relevant(user, getattr(obj, "patient_id", None))
        return False
