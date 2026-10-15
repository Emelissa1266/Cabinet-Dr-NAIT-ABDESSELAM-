"""Transactional author-only workflow; audit never copies clinical free text."""

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.audit.services import record_audit_event
from apps.billing.services import next_financial_number

from .models import WorkLeave

DEFAULT_CERTIFICATE_TEXT = (
    "Je soussigné, {doctor}, prescris un arrêt de travail pour {patient}, "
    "d'une durée de {duration} jours calendaires, du {start} au {end} inclus."
)


def certificate_text(leave):
    template = getattr(settings, "WORK_LEAVE_CERTIFICATE_TEXT", DEFAULT_CERTIFICATE_TEXT)
    try:
        return template.format(
            doctor=leave.doctor_name_snapshot or str(leave.doctor),
            patient=leave.patient_name_snapshot
            or f"{leave.patient.first_name} {leave.patient.last_name}",
            duration=leave.duration_days,
            start=f"{leave.start_date:%d/%m/%Y}",
            end=f"{leave.end_date:%d/%m/%Y}",
        )
    except (KeyError, ValueError, IndexError) as error:
        raise ValidationError("Le modèle de certificat configuré est invalide.") from error


def owner(leave, actor):
    if not actor.is_active or actor.role != User.Role.DOCTOR or leave.doctor_id != actor.pk:
        raise PermissionDenied("Seul le médecin auteur est autorisé.")


def audit(leave, actor, action, request=None, old_status=None, changed_fields=None):
    record_audit_event(
        user=actor,
        action=action,
        entity_type="WorkLeave",
        entity_id=leave.pk,
        old_data={"status": old_status} if old_status else None,
        new_data={
            "status": leave.status,
            "reference": leave.certificate_number,
            "changed_fields": sorted(changed_fields or []),
        },
        request=request,
    )


@transaction.atomic
def create_leave(*, actor, data, request=None):
    leave = WorkLeave(doctor=actor, created_by=actor, **data)
    owner(leave, actor)
    leave.certificate_number = next_financial_number(key="work_leave", prefix="AT")
    leave.full_clean()
    leave.save()
    audit(leave, actor, "WORK_LEAVE_CREATED", request)
    return leave


@transaction.atomic
def change_leave(*, pk, actor, action, data=None, request=None):
    leave = WorkLeave.objects.select_for_update().select_related("doctor", "patient").get(pk=pk)
    owner(leave, actor)
    old_status = leave.status
    if action in {"update", "issue", "delete"} and leave.status != WorkLeave.Status.DRAFT:
        raise ValidationError("Seul un brouillon peut être modifié, émis ou supprimé.")
    if action == "update":
        for key, value in data.items():
            setattr(leave, key, value)
        leave.full_clean()
        leave.save()
    elif action == "issue":
        if leave.previous_leave_id:
            # Serialize validation with concurrent cancellation of the predecessor.
            leave.previous_leave = WorkLeave.objects.select_for_update().get(
                pk=leave.previous_leave_id
            )
        leave.full_clean()
        leave.patient_name_snapshot = (
            f"{leave.patient.first_name} {leave.patient.last_name}".strip()
        )
        leave.patient_birth_date_snapshot = leave.patient.date_of_birth
        leave.doctor_name_snapshot = str(leave.doctor)
        leave.certificate_text_snapshot = certificate_text(leave)
        leave.status = WorkLeave.Status.ISSUED
        leave.issued_at = timezone.now()
        leave.save()
    elif action == "cancel":
        if leave.status != WorkLeave.Status.ISSUED:
            raise ValidationError("Seul un arrêt émis peut être annulé.")
        reason = str((data or {}).get("cancellation_reason", "")).strip()
        if not reason:
            raise ValidationError({"cancellation_reason": "Le motif d'annulation est obligatoire."})
        leave.status = WorkLeave.Status.CANCELLED
        leave.cancelled_at = timezone.now()
        leave.cancellation_reason = reason
        leave.save(update_fields=["status", "cancelled_at", "cancellation_reason", "updated_at"])
    elif action == "delete":
        if leave.extensions.exists():
            raise ValidationError("Cet arrêt est référencé par une prolongation.")
        audit(leave, actor, "WORK_LEAVE_DELETED", request, old_status)
        leave.delete()
        return None
    audit(
        leave,
        actor,
        f"WORK_LEAVE_{ {'update': 'UPDATED', 'issue': 'ISSUED', 'cancel': 'CANCELLED'}[action] }",
        request,
        old_status,
        changed_fields=data.keys() if action == "update" else [],
    )
    return leave


def history(leave):
    return AuditLog.objects.filter(entity_type="WorkLeave", entity_id=str(leave.pk)).order_by(
        "created_at", "id"
    )
