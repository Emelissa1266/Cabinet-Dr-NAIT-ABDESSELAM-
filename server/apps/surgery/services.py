from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event

from .models import (
    PreoperativeAssessment,
    PreoperativeChecklistItem,
    PreoperativeRequirement,
    Surgery,
    SurgeryConsent,
    SurgeryOperativeRecord,
    SurgeryPreoperativeChecklist,
)


def validate_surgery_readiness(surgery: Surgery) -> None:
    errors = []
    if surgery.status not in {Surgery.Status.PREOP_IN_PROGRESS, Surgery.Status.READY}:
        errors.append("Surgery must be in pre-operative progress before readiness validation.")
    if not surgery.surgeon_id:
        errors.append("Surgeon is required.")
    if not surgery.procedure_name.strip():
        errors.append("Procedure is required.")
    try:
        assessment = surgery.preoperative_assessment
    except PreoperativeAssessment.DoesNotExist:
        assessment = None
    if not assessment or assessment.readiness_status != PreoperativeAssessment.ReadinessStatus.READY:
        errors.append("A READY pre-operative assessment is required.")

    active_required_items = PreoperativeChecklistItem.objects.filter(is_active=True, is_required=True)
    executions_by_item = {
        execution.checklist_item_id: execution
        for execution in surgery.preop_checklists.select_related("checklist_item").filter(
            checklist_item__is_active=True,
            checklist_item__is_required=True,
        )
    }
    for item in active_required_items:
        execution = executions_by_item.get(item.id)
        if not execution:
            errors.append(f"Required checklist item is not satisfied: {item.name}.")
            continue
        if execution.status not in {
            SurgeryPreoperativeChecklist.Status.COMPLETED,
            SurgeryPreoperativeChecklist.Status.NOT_APPLICABLE,
        }:
            errors.append(f"Required checklist item is not satisfied: {item.name}.")

    for requirement in surgery.preop_requirements.filter(required=True):
        if requirement.status not in {
            PreoperativeRequirement.Status.SATISFIED,
            PreoperativeRequirement.Status.WAIVED,
        }:
            errors.append(f"Required pre-operative requirement is unresolved: {requirement.name}.")
        if requirement.status == PreoperativeRequirement.Status.BLOCKED:
            errors.append(f"Blocking pre-operative requirement: {requirement.name}.")

    required_consents = surgery.consents.filter(required=True)
    if not required_consents.exists():
        errors.append("At least one required confirmed consent is required.")
    for consent in required_consents:
        if consent.status != SurgeryConsent.Status.CONFIRMED:
            errors.append(f"Required consent is not confirmed: {consent.consent_type}.")

    if errors:
        raise ValidationError(errors)


def _transition(surgery: Surgery, actor, *, from_statuses, to_status, action, request=None, **updates):
    with transaction.atomic():
        locked = Surgery.objects.select_for_update().get(pk=surgery.pk)
        if locked.status not in from_statuses:
            raise ValidationError(f"Cannot transition surgery from {locked.status} to {to_status}.")
        old_data = {"status": locked.status}
        for field, value in updates.items():
            setattr(locked, field, value)
        locked.status = to_status
        locked.full_clean()
        locked.save()
        record_audit_event(
            user=actor,
            action=action,
            entity_type="Surgery",
            entity_id=locked.pk,
            old_data=old_data,
            new_data={"status": locked.status},
            request=request,
        )
        return locked


def plan_surgery(*, surgery: Surgery, actor, request=None) -> Surgery:
    return _transition(
        surgery,
        actor,
        from_statuses={Surgery.Status.DRAFT},
        to_status=Surgery.Status.PLANNED,
        action="SURGERY_PLANNED",
        request=request,
    )


def begin_preop(*, surgery: Surgery, actor, request=None) -> Surgery:
    return _transition(
        surgery,
        actor,
        from_statuses={Surgery.Status.PLANNED},
        to_status=Surgery.Status.PREOP_IN_PROGRESS,
        action="SURGERY_PREOP_STARTED",
        request=request,
    )


def mark_ready(*, surgery: Surgery, actor, request=None) -> Surgery:
    with transaction.atomic():
        locked = Surgery.objects.select_for_update().get(pk=surgery.pk)
        validate_surgery_readiness(locked)
        old_data = {"status": locked.status}
        locked.status = Surgery.Status.READY
        locked.save(update_fields=["status", "updated_at"])
        record_audit_event(
            user=actor,
            action="SURGERY_READY_APPROVED",
            entity_type="Surgery",
            entity_id=locked.pk,
            old_data=old_data,
            new_data={"status": locked.status},
            request=request,
        )
        return locked


def start_surgery(*, surgery: Surgery, actor, request=None) -> Surgery:
    with transaction.atomic():
        locked = Surgery.objects.select_for_update().get(pk=surgery.pk)
        if locked.status != Surgery.Status.READY:
            raise ValidationError("Only READY surgery can be started.")
        validate_surgery_readiness(locked)
        old_data = {"status": locked.status, "actual_start_at": locked.actual_start_at}
        locked.status = Surgery.Status.IN_PROGRESS
        locked.actual_start_at = locked.actual_start_at or timezone.now()
        locked.full_clean()
        locked.save(update_fields=["status", "actual_start_at", "updated_at"])
        record_audit_event(
            user=actor,
            action="SURGERY_STARTED",
            entity_type="Surgery",
            entity_id=locked.pk,
            old_data=old_data,
            new_data={"status": locked.status, "actual_start_at": locked.actual_start_at.isoformat()},
            request=request,
        )
        return locked


def complete_surgery(*, surgery: Surgery, actor, request=None) -> Surgery:
    with transaction.atomic():
        locked = Surgery.objects.select_for_update().get(pk=surgery.pk)
        if locked.status != Surgery.Status.IN_PROGRESS:
            raise ValidationError("Only IN_PROGRESS surgery can be completed.")
        try:
            operative_record = locked.operative_record
        except SurgeryOperativeRecord.DoesNotExist as error:
            raise ValidationError("Operative record is required before completion.") from error
        if not operative_record.procedure_performed or not operative_record.operative_findings:
            raise ValidationError("Required operative information is missing.")
        end_at = operative_record.actual_end_at or timezone.now()
        start_at = locked.actual_start_at or operative_record.actual_start_at
        if end_at < start_at:
            raise ValidationError("Surgery completion time cannot precede start time.")
        old_data = {"status": locked.status, "actual_end_at": locked.actual_end_at}
        locked.actual_start_at = start_at
        locked.actual_end_at = end_at
        locked.status = Surgery.Status.COMPLETED
        locked.full_clean()
        locked.save(update_fields=["actual_start_at", "actual_end_at", "status", "updated_at"])
        record_audit_event(
            user=actor,
            action="SURGERY_COMPLETED",
            entity_type="Surgery",
            entity_id=locked.pk,
            old_data=old_data,
            new_data={"status": locked.status, "actual_end_at": locked.actual_end_at.isoformat()},
            request=request,
        )
        return locked


def cancel_surgery(*, surgery: Surgery, actor, reason: str, request=None) -> Surgery:
    if not reason.strip():
        raise ValidationError("Cancellation reason is required.")
    return _transition(
        surgery,
        actor,
        from_statuses={
            Surgery.Status.DRAFT,
            Surgery.Status.PLANNED,
            Surgery.Status.PREOP_IN_PROGRESS,
            Surgery.Status.READY,
        },
        to_status=Surgery.Status.CANCELLED,
        action="SURGERY_CANCELLED",
        request=request,
        cancellation_reason=reason,
        cancelled_by=actor,
        cancelled_at=timezone.now(),
    )
