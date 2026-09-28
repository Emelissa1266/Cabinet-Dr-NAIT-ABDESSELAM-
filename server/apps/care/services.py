from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event

from .models import Care, CareSession


def refresh_care_progress(care: Care) -> Care:
    completed = care.completed_sessions
    if completed >= care.planned_sessions and care.status != Care.Status.CANCELLED:
        care.status = Care.Status.COMPLETED
    elif completed > 0 and care.status == Care.Status.PLANNED:
        care.status = Care.Status.IN_PROGRESS
    care.save(update_fields=["status", "updated_at"])
    return care


def validate_required_parameters(session: CareSession) -> None:
    required_ids = set(
        session.care.care_type.parameter_definitions.filter(required=True, active=True).values_list(
            "id",
            flat=True,
        )
    )
    if not required_ids:
        return
    present_ids = set(
        session.parameters.filter(
            parameter_definition_id__in=required_ids,
        )
        .exclude(value="")
        .values_list("parameter_definition_id", flat=True)
    )
    missing_ids = required_ids - present_ids
    if missing_ids:
        raise ValidationError("Required care parameters must be recorded before completion.")


@transaction.atomic
def start_care_session(*, session: CareSession, nurse, request=None) -> CareSession:
    locked = CareSession.objects.select_for_update().select_related("care").get(pk=session.pk)
    if locked.status != CareSession.Status.PLANNED:
        raise ValidationError("Only planned care sessions can be started.")
    if nurse.role != "NURSE" or locked.nurse_id != nurse.id:
        raise ValidationError("Only the assigned nurse can start this session.")

    old_data = {"status": locked.status, "started_at": locked.started_at}
    locked.status = CareSession.Status.IN_PROGRESS
    locked.started_at = timezone.now()
    locked.save(update_fields=["status", "started_at", "updated_at"])
    if locked.care.status == Care.Status.PLANNED:
        locked.care.status = Care.Status.IN_PROGRESS
        locked.care.save(update_fields=["status", "updated_at"])
    record_audit_event(
        user=nurse,
        action="CARE_SESSION_STARTED",
        entity_type="CareSession",
        entity_id=locked.pk,
        old_data=old_data,
        new_data={"status": locked.status, "started_at": locked.started_at.isoformat()},
        request=request,
    )
    return locked


@transaction.atomic
def complete_care_session(*, session: CareSession, nurse, request=None) -> CareSession:
    locked = (
        CareSession.objects.select_for_update()
        .select_related("care", "care__care_type")
        .get(pk=session.pk)
    )
    if locked.status != CareSession.Status.IN_PROGRESS:
        raise ValidationError("Only in-progress care sessions can be completed.")
    if nurse.role != "NURSE" or locked.nurse_id != nurse.id:
        raise ValidationError("Only the assigned nurse can complete this session.")

    validate_required_parameters(locked)
    old_data = {"status": locked.status, "completed_at": locked.completed_at}
    locked.status = CareSession.Status.COMPLETED
    locked.completed_at = timezone.now()
    locked.save(update_fields=["status", "completed_at", "updated_at"])
    refresh_care_progress(locked.care)
    record_audit_event(
        user=nurse,
        action="CARE_SESSION_COMPLETED",
        entity_type="CareSession",
        entity_id=locked.pk,
        old_data=old_data,
        new_data={"status": locked.status, "completed_at": locked.completed_at.isoformat()},
        request=request,
    )
    return locked
