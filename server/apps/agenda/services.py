from dataclasses import dataclass
from datetime import datetime, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event

from .models import (
    Appointment,
    AppointmentReschedule,
    AppointmentStaff,
    AppointmentType,
    ClinicClosure,
    StaffTimeOff,
    StaffWorkingHours,
)

NON_BLOCKING_STATUSES = {Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW}


@dataclass(frozen=True)
class Slot:
    start_at: datetime
    end_at: datetime


def derive_end_at(*, appointment_type: AppointmentType, start_at, end_at=None):
    if end_at:
        return end_at
    return start_at + timedelta(minutes=appointment_type.default_duration_minutes)


def appointment_staff_ids(*, primary_staff, staff_ids=None):
    ids = {primary_staff.id}
    ids.update(staff_ids or [])
    return sorted(ids)


def validate_interval(start_at, end_at):
    if not start_at or not end_at or start_at >= end_at:
        raise ValidationError("Appointment start_at must be before end_at.")


def validate_working_hours(*, staff_id, start_at, end_at):
    local_start = timezone.localtime(start_at)
    local_end = timezone.localtime(end_at)
    if local_start.date() != local_end.date():
        raise ValidationError("Appointments must fit within one working day.")
    matches = StaffWorkingHours.objects.filter(
        staff_id=staff_id,
        weekday=local_start.weekday(),
        is_active=True,
        start_time__lte=local_start.time(),
        end_time__gte=local_end.time(),
    )
    if not matches.exists():
        raise ValidationError("Appointment is outside staff working hours.")


def validate_no_time_off(*, staff_id, start_at, end_at):
    if StaffTimeOff.objects.filter(staff_id=staff_id, start_at__lt=end_at, end_at__gt=start_at).exists():
        raise ValidationError("Appointment overlaps staff time off.")


def validate_no_closure(*, start_at, end_at):
    if ClinicClosure.objects.filter(start_at__lt=end_at, end_at__gt=start_at).exists():
        raise ValidationError("Appointment overlaps a clinic closure.")


def validate_no_conflicts(*, staff_ids, start_at, end_at, exclude_appointment_id=None):
    appointments = Appointment.objects.select_for_update().filter(
        start_at__lt=end_at,
        end_at__gt=start_at,
    ).exclude(status__in=NON_BLOCKING_STATUSES)
    if exclude_appointment_id:
        appointments = appointments.exclude(id=exclude_appointment_id)
    primary_conflict = appointments.filter(primary_staff_id__in=staff_ids).exists()
    participant_conflict = appointments.filter(staff_members__user_id__in=staff_ids).exists()
    if primary_conflict or participant_conflict:
        raise ValidationError("Appointment conflicts with an existing appointment.")


def validate_role_requirements(*, appointment_type, primary_staff):
    if appointment_type.requires_doctor and primary_staff.role != "DOCTOR":
        raise ValidationError("Appointment type requires doctor primary staff.")
    if appointment_type.requires_nurse and primary_staff.role != "NURSE":
        raise ValidationError("Appointment type requires nurse primary staff.")


def validate_linked_objects(*, patient, consultation=None, surgery=None, care_session=None):
    if consultation and consultation.patient_id != patient.id:
        raise ValidationError("Appointment patient must match consultation patient.")
    if surgery and surgery.patient_id != patient.id:
        raise ValidationError("Appointment patient must match surgery patient.")
    if care_session and care_session.care.patient_id != patient.id:
        raise ValidationError("Appointment patient must match care session patient.")


def validate_schedule(*, appointment_type, primary_staff, patient, start_at, end_at, staff_ids=None, exclude_appointment_id=None, consultation=None, surgery=None, care_session=None):
    validate_interval(start_at, end_at)
    if not appointment_type.is_active and not exclude_appointment_id:
        raise ValidationError("Inactive appointment types cannot be used for new appointments.")
    validate_role_requirements(appointment_type=appointment_type, primary_staff=primary_staff)
    validate_linked_objects(patient=patient, consultation=consultation, surgery=surgery, care_session=care_session)
    all_staff_ids = appointment_staff_ids(primary_staff=primary_staff, staff_ids=staff_ids)
    validate_no_closure(start_at=start_at, end_at=end_at)
    for staff_id in all_staff_ids:
        validate_working_hours(staff_id=staff_id, start_at=start_at, end_at=end_at)
        validate_no_time_off(staff_id=staff_id, start_at=start_at, end_at=end_at)
    validate_no_conflicts(
        staff_ids=all_staff_ids,
        start_at=start_at,
        end_at=end_at,
        exclude_appointment_id=exclude_appointment_id,
    )


@transaction.atomic
def create_appointment(*, actor, patient, appointment_type, primary_staff, start_at, end_at=None, staff_members=None, request=None, **fields):
    staff_members = staff_members or []
    end_at = derive_end_at(appointment_type=appointment_type, start_at=start_at, end_at=end_at)
    staff_ids = [item["user"].id for item in staff_members if item.get("user")]
    validate_schedule(
        appointment_type=appointment_type,
        primary_staff=primary_staff,
        patient=patient,
        start_at=start_at,
        end_at=end_at,
        staff_ids=staff_ids,
        consultation=fields.get("consultation"),
        surgery=fields.get("surgery"),
        care_session=fields.get("care_session"),
    )
    appointment = Appointment.objects.create(
        patient=patient,
        appointment_type=appointment_type,
        primary_staff=primary_staff,
        start_at=start_at,
        end_at=end_at,
        created_by=actor,
        **fields,
    )
    for item in staff_members:
        AppointmentStaff.objects.create(appointment=appointment, **item)
    record_audit_event(
        user=actor,
        action="APPOINTMENT_CREATED",
        entity_type="Appointment",
        entity_id=appointment.pk,
        new_data={"start_at": appointment.start_at.isoformat(), "end_at": appointment.end_at.isoformat()},
        request=request,
    )
    return appointment


def _transition(*, appointment, actor, valid_from, to_status, action, request=None, **updates):
    with transaction.atomic():
        locked = Appointment.objects.select_for_update().get(pk=appointment.pk)
        if locked.status not in valid_from:
            raise ValidationError(f"Cannot transition appointment from {locked.status} to {to_status}.")
        old_data = {"status": locked.status}
        for field, value in updates.items():
            setattr(locked, field, value)
        locked.status = to_status
        locked.save()
        record_audit_event(
            user=actor,
            action=action,
            entity_type="Appointment",
            entity_id=locked.pk,
            old_data=old_data,
            new_data={"status": locked.status},
            request=request,
        )
        return locked


def confirm_appointment(*, appointment, actor, request=None):
    return _transition(
        appointment=appointment,
        actor=actor,
        valid_from={Appointment.Status.SCHEDULED},
        to_status=Appointment.Status.CONFIRMED,
        action="APPOINTMENT_CONFIRMED",
        request=request,
    )


def check_in_appointment(*, appointment, actor, request=None):
    return _transition(
        appointment=appointment,
        actor=actor,
        valid_from={Appointment.Status.CONFIRMED},
        to_status=Appointment.Status.CHECKED_IN,
        action="APPOINTMENT_CHECKED_IN",
        request=request,
        checked_in_at=timezone.now(),
    )


def start_appointment(*, appointment, actor, request=None):
    return _transition(
        appointment=appointment,
        actor=actor,
        valid_from={Appointment.Status.CHECKED_IN},
        to_status=Appointment.Status.IN_PROGRESS,
        action="APPOINTMENT_STARTED",
        request=request,
    )


def complete_appointment(*, appointment, actor, request=None):
    return _transition(
        appointment=appointment,
        actor=actor,
        valid_from={Appointment.Status.IN_PROGRESS},
        to_status=Appointment.Status.COMPLETED,
        action="APPOINTMENT_COMPLETED",
        request=request,
        completed_at=timezone.now(),
    )


def no_show_appointment(*, appointment, actor, request=None):
    return _transition(
        appointment=appointment,
        actor=actor,
        valid_from={Appointment.Status.SCHEDULED, Appointment.Status.CONFIRMED},
        to_status=Appointment.Status.NO_SHOW,
        action="APPOINTMENT_NO_SHOW",
        request=request,
        no_show_at=timezone.now(),
    )


def cancel_appointment(*, appointment, actor, reason, request=None):
    if not reason.strip():
        raise ValidationError("Cancellation reason is required.")
    return _transition(
        appointment=appointment,
        actor=actor,
        valid_from={Appointment.Status.SCHEDULED, Appointment.Status.CONFIRMED, Appointment.Status.CHECKED_IN},
        to_status=Appointment.Status.CANCELLED,
        action="APPOINTMENT_CANCELLED",
        request=request,
        cancellation_reason=reason,
        cancelled_by=actor,
        cancelled_at=timezone.now(),
    )


@transaction.atomic
def reschedule_appointment(*, appointment, actor, new_start_at, new_end_at=None, reason="", request=None):
    locked = Appointment.objects.select_for_update().select_related(
        "patient",
        "appointment_type",
        "primary_staff",
        "consultation",
        "surgery",
        "care_session",
    ).get(pk=appointment.pk)
    if locked.status in {Appointment.Status.COMPLETED, Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW}:
        raise ValidationError("Completed, cancelled, or no-show appointments cannot be rescheduled.")
    new_end_at = derive_end_at(
        appointment_type=locked.appointment_type,
        start_at=new_start_at,
        end_at=new_end_at,
    )
    staff_ids = list(locked.staff_members.values_list("user_id", flat=True))
    validate_schedule(
        appointment_type=locked.appointment_type,
        primary_staff=locked.primary_staff,
        patient=locked.patient,
        start_at=new_start_at,
        end_at=new_end_at,
        staff_ids=staff_ids,
        exclude_appointment_id=locked.pk,
        consultation=locked.consultation,
        surgery=locked.surgery,
        care_session=locked.care_session,
    )
    old_start_at = locked.start_at
    old_end_at = locked.end_at
    locked.start_at = new_start_at
    locked.end_at = new_end_at
    locked.save(update_fields=["start_at", "end_at", "updated_at"])
    AppointmentReschedule.objects.create(
        appointment=locked,
        old_start_at=old_start_at,
        old_end_at=old_end_at,
        new_start_at=new_start_at,
        new_end_at=new_end_at,
        reason=reason,
        changed_by=actor,
    )
    record_audit_event(
        user=actor,
        action="APPOINTMENT_RESCHEDULED",
        entity_type="Appointment",
        entity_id=locked.pk,
        old_data={"start_at": old_start_at.isoformat(), "end_at": old_end_at.isoformat()},
        new_data={"start_at": new_start_at.isoformat(), "end_at": new_end_at.isoformat()},
        request=request,
    )
    return locked


def find_available_slots(*, staff, appointment_type, date_from, date_to, duration_minutes=None):
    duration = timedelta(minutes=duration_minutes or appointment_type.default_duration_minutes)
    interval = timedelta(minutes=getattr(settings, "AGENDA_SLOT_INTERVAL_MINUTES", 30))
    slots = []
    day = date_from
    while day <= date_to:
        for hours in StaffWorkingHours.objects.filter(staff=staff, weekday=day.weekday(), is_active=True):
            start = timezone.make_aware(datetime.combine(day, hours.start_time))
            end_boundary = timezone.make_aware(datetime.combine(day, hours.end_time))
            current = start
            while current + duration <= end_boundary:
                slot_end = current + duration
                try:
                    validate_no_closure(start_at=current, end_at=slot_end)
                    validate_no_time_off(staff_id=staff.id, start_at=current, end_at=slot_end)
                    validate_no_conflicts(staff_ids=[staff.id], start_at=current, end_at=slot_end)
                except ValidationError:
                    current += interval
                    continue
                slots.append(Slot(start_at=current, end_at=slot_end))
                current += interval
        day += timedelta(days=1)
    return slots
