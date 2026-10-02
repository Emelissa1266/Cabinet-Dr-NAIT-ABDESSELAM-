from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from apps.audit.models import AuditLog
from apps.care.models import Care, CareCategory, CareType
from apps.medical.models import Consultation, MedicalInstruction, Prescription
from apps.patients.models import Patient
from apps.surgery.models import (
    InterventionType,
    IntraoperativeEvent,
    PostoperativeFollowUp,
    PreoperativeChecklistItem,
    Surgery,
    SurgeryComplication,
    SurgeryConsent,
    SurgeryTeamMember,
)


@pytest.fixture
def patient(db, doctor_user):
    return Patient.objects.create(first_name="Surgery", last_name="Patient", created_by=doctor_user)


@pytest.fixture
def consultation(patient, doctor_user):
    return Consultation.objects.create(
        patient=patient,
        doctor=doctor_user,
        consultation_date=timezone.now(),
        consultation_type=Consultation.ConsultationType.INITIAL,
        reason="Surgical decision",
        diagnosis="Indicated",
        treatment_plan="Surgery",
    )


@pytest.fixture
def surgery_payload(patient, consultation):
    return {
        "patient": patient.id,
        "consultation": consultation.id,
        "procedure_name": "Rhinoplasty",
        "procedure_code": "RHINO",
        "procedure_description": "Aesthetic rhinoplasty",
        "indication": "Functional and aesthetic indication",
        "planned_date": (timezone.now() + timedelta(days=7)).isoformat(),
        "priority": "NORMAL",
        "laterality": "NOT_APPLICABLE",
        "anatomical_site": "Nose",
        "anesthesia_type": "GENERAL",
        "notes": "Surgical note",
    }


@pytest.fixture
def surgery(patient, consultation, doctor_user):
    return Surgery.objects.create(
        patient=patient,
        consultation=consultation,
        surgeon=doctor_user,
        procedure_name="Rhinoplasty",
        indication="Clinical indication",
        planned_date=timezone.now() + timedelta(days=7),
        anatomical_site="Nose",
        anesthesia_type=Surgery.AnesthesiaType.GENERAL,
    )


def create_ready_artifacts(api_client, surgery, doctor_user):
    item = PreoperativeChecklistItem.objects.create(name="Consent confirmed", is_required=True)
    api_client.force_authenticate(user=doctor_user)
    api_client.post(
        "/api/v1/preoperative-assessments/",
        {
            "surgery": surgery.id,
            "medical_history_reviewed": True,
            "allergies_reviewed": True,
            "medications_reviewed": True,
            "contraindications_reviewed": True,
            "fasting_status": "CONFIRMED",
            "anesthesia_evaluation_status": "CLEARED",
            "required_tests_reviewed": True,
            "readiness_status": "READY",
            "assessment_notes": "Ready",
        },
        format="json",
    )
    api_client.post(
        "/api/v1/preoperative-checklists/",
        {"surgery": surgery.id, "checklist_item": item.id, "status": "COMPLETED"},
        format="json",
    )
    api_client.post(
        "/api/v1/preoperative-requirements/",
        {
            "surgery": surgery.id,
            "name": "Lab review",
            "requirement_type": "LAB",
            "required": True,
            "status": "SATISFIED",
            "result_summary": "Normal",
        },
        format="json",
    )
    api_client.post(
        "/api/v1/surgery-consents/",
        {
            "surgery": surgery.id,
            "consent_type": "Surgical consent",
            "required": True,
            "status": "CONFIRMED",
        },
        format="json",
    )


@pytest.mark.django_db
def test_intervention_type_admin_catalog_rbac_snapshot_and_audit(
    api_client,
    admin_user,
    doctor_user,
    nurse_user,
    secretary_user,
    patient,
    consultation,
):
    api_client.force_authenticate(user=admin_user)
    created = api_client.post(
        "/api/v1/intervention-types/",
        {
            "name": "Rhinoplastie catalog",
            "code": "RHINO-CAT",
            "description": "Configured rhinoplasty",
            "is_active": True,
        },
        format="json",
    )
    assert created.status_code == status.HTTP_201_CREATED, created.data
    intervention_type_id = created.data["id"]
    assert AuditLog.objects.filter(
        action="INTERVENTION_TYPE_CREATED",
        entity_id=str(intervention_type_id),
    ).exists()

    updated = api_client.patch(
        f"/api/v1/intervention-types/{intervention_type_id}/",
        {"description": "Updated configured rhinoplasty"},
        format="json",
    )
    assert updated.status_code == status.HTTP_200_OK

    api_client.force_authenticate(user=doctor_user)
    doctor_read = api_client.get("/api/v1/intervention-types/?is_active=true")
    doctor_write = api_client.patch(
        f"/api/v1/intervention-types/{intervention_type_id}/",
        {"name": "Doctor managed"},
        format="json",
    )
    assert doctor_read.status_code == status.HTTP_200_OK
    assert doctor_read.data["results"][0]["name"] == "Rhinoplastie catalog"
    assert doctor_write.status_code == status.HTTP_403_FORBIDDEN

    for role_user in (nurse_user, secretary_user):
        api_client.force_authenticate(user=role_user)
        response = api_client.get("/api/v1/intervention-types/")
        forbidden = api_client.post(
            "/api/v1/intervention-types/",
            {"name": f"Blocked {role_user.role}", "code": f"BLOCK-{role_user.role}"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert forbidden.status_code == status.HTTP_403_FORBIDDEN

    api_client.force_authenticate(user=doctor_user)
    surgery = api_client.post(
        "/api/v1/surgeries/",
        {
            "patient": patient.id,
            "consultation": consultation.id,
            "intervention_type": intervention_type_id,
            "procedure_name": "Contradictory frontend value",
            "procedure_code": "WRONG",
            "indication": "Catalog-backed surgery",
            "planned_date": (timezone.now() + timedelta(days=7)).isoformat(),
            "priority": "NORMAL",
            "laterality": "NOT_APPLICABLE",
            "anatomical_site": "Nose",
            "anesthesia_type": "GENERAL",
        },
        format="json",
    )
    assert surgery.status_code == status.HTTP_201_CREATED, surgery.data
    assert surgery.data["intervention_type"] == intervention_type_id
    assert surgery.data["intervention_type_name"] == "Rhinoplastie catalog"
    assert surgery.data["procedure_name"] == "Rhinoplastie catalog"
    assert surgery.data["procedure_code"] == "RHINO-CAT"

    legacy = Surgery.objects.create(
        patient=patient,
        consultation=consultation,
        surgeon=doctor_user,
        procedure_name="Legacy free text",
        procedure_code="LEGACY",
        indication="Historical surgery",
    )
    legacy_read = api_client.get(f"/api/v1/surgeries/{legacy.id}/")
    assert legacy_read.status_code == status.HTTP_200_OK
    assert legacy_read.data["intervention_type"] is None
    assert legacy_read.data["procedure_name"] == "Legacy free text"

    api_client.force_authenticate(user=admin_user)
    deactivated = api_client.patch(
        f"/api/v1/intervention-types/{intervention_type_id}/",
        {"is_active": False},
        format="json",
    )
    assert deactivated.status_code == status.HTTP_200_OK

    api_client.force_authenticate(user=doctor_user)
    inactive_create = api_client.post(
        "/api/v1/surgeries/",
        {
            "patient": patient.id,
            "intervention_type": intervention_type_id,
            "indication": "Inactive catalog should fail",
        },
        format="json",
    )
    historical_read = api_client.get(f"/api/v1/surgeries/{surgery.data['id']}/")
    assert inactive_create.status_code == status.HTTP_400_BAD_REQUEST
    assert historical_read.status_code == status.HTTP_200_OK
    assert historical_read.data["intervention_type_name"] == "Rhinoplastie catalog"


@pytest.mark.django_db
def test_completed_surgery_intervention_identity_cannot_change(api_client, doctor_user, patient, consultation):
    old_type = InterventionType.objects.create(name="Blepharoplastie", code="BLEPH", is_active=True)
    new_type = InterventionType.objects.create(name="Abdominoplastie", code="ABDO", is_active=True)
    surgery = Surgery.objects.create(
        patient=patient,
        consultation=consultation,
        surgeon=doctor_user,
        intervention_type=old_type,
        procedure_name=old_type.name,
        procedure_code=old_type.code,
        indication="Completed surgery",
        status=Surgery.Status.COMPLETED,
    )
    api_client.force_authenticate(user=doctor_user)
    response = api_client.patch(
        f"/api/v1/surgeries/{surgery.id}/",
        {"intervention_type": new_type.id},
        format="json",
    )
    surgery.refresh_from_db()
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert surgery.intervention_type == old_type
    assert surgery.procedure_name == old_type.name


@pytest.mark.django_db
def test_doctor_creates_surgery_and_patient_consultation_consistency(
    api_client,
    doctor_user,
    surgery_payload,
    consultation,
):
    api_client.force_authenticate(user=doctor_user)
    response = api_client.post("/api/v1/surgeries/", surgery_payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["surgeon"] == doctor_user.id
    assert response.data["status"] == Surgery.Status.DRAFT
    assert AuditLog.objects.filter(action="SURGERY_CREATED").count() == 1

    other_patient = Patient.objects.create(first_name="Other", last_name="Patient")
    invalid = api_client.post(
        "/api/v1/surgeries/",
        {**surgery_payload, "patient": other_patient.id, "consultation": consultation.id},
        format="json",
    )
    assert invalid.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_non_doctor_cannot_author_surgery(api_client, nurse_user, secretary_user, surgery_payload):
    for user in (nurse_user, secretary_user):
        api_client.force_authenticate(user=user)
        response = api_client.post("/api/v1/surgeries/", surgery_payload, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
    assert Surgery.objects.count() == 0


@pytest.mark.django_db
def test_valid_surgery_state_machine_and_audit(api_client, doctor_user, surgery):
    api_client.force_authenticate(user=doctor_user)
    assert api_client.post(f"/api/v1/surgeries/{surgery.id}/plan/").data["status"] == "PLANNED"
    assert api_client.post(f"/api/v1/surgeries/{surgery.id}/begin-preop/").data["status"] == "PREOP_IN_PROGRESS"
    create_ready_artifacts(api_client, surgery, doctor_user)
    assert api_client.post(f"/api/v1/surgeries/{surgery.id}/mark-ready/").data["status"] == "READY"
    started = api_client.post(f"/api/v1/surgeries/{surgery.id}/start/")
    assert started.data["status"] == "IN_PROGRESS"

    start_at = Surgery.objects.get(pk=surgery.id).actual_start_at
    op = api_client.post(
        "/api/v1/operative-records/",
        {
            "surgery": surgery.id,
            "procedure_performed": "Rhinoplasty",
            "operative_findings": "No unexpected findings",
            "operative_technique": "Open technique",
            "actual_start_at": start_at.isoformat(),
            "actual_end_at": (start_at + timedelta(hours=2)).isoformat(),
            "anesthesia_type": "GENERAL",
            "immediate_postoperative_condition": "Stable",
        },
        format="json",
    )
    assert op.status_code == status.HTTP_201_CREATED

    completed = api_client.post(f"/api/v1/surgeries/{surgery.id}/complete/")
    assert completed.status_code == status.HTTP_200_OK
    assert completed.data["status"] == "COMPLETED"
    assert AuditLog.objects.filter(action="SURGERY_STARTED").count() == 1
    assert AuditLog.objects.filter(action="SURGERY_COMPLETED").count() == 1


@pytest.mark.django_db
def test_invalid_transitions_and_terminal_states_do_not_mutate(api_client, doctor_user, surgery):
    api_client.force_authenticate(user=doctor_user)
    direct_start = api_client.post(f"/api/v1/surgeries/{surgery.id}/start/")
    surgery.refresh_from_db()
    assert direct_start.status_code == status.HTTP_400_BAD_REQUEST
    assert surgery.status == Surgery.Status.DRAFT

    api_client.post(f"/api/v1/surgeries/{surgery.id}/plan/")
    direct_complete = api_client.post(f"/api/v1/surgeries/{surgery.id}/complete/")
    surgery.refresh_from_db()
    assert direct_complete.status_code == status.HTTP_400_BAD_REQUEST
    assert surgery.status == Surgery.Status.PLANNED

    cancelled = api_client.post(f"/api/v1/surgeries/{surgery.id}/cancel/", {"reason": "Patient request"}, format="json")
    restart = api_client.post(f"/api/v1/surgeries/{surgery.id}/start/")
    surgery.refresh_from_db()
    assert cancelled.data["status"] == Surgery.Status.CANCELLED
    assert restart.status_code == status.HTTP_400_BAD_REQUEST
    assert surgery.status == Surgery.Status.CANCELLED


@pytest.mark.django_db
def test_readiness_requires_assessment_checklist_requirement_and_consent(api_client, doctor_user, surgery):
    api_client.force_authenticate(user=doctor_user)
    api_client.post(f"/api/v1/surgeries/{surgery.id}/plan/")
    api_client.post(f"/api/v1/surgeries/{surgery.id}/begin-preop/")

    missing = api_client.post(f"/api/v1/surgeries/{surgery.id}/mark-ready/")
    assert missing.status_code == status.HTTP_400_BAD_REQUEST

    create_ready_artifacts(api_client, surgery, doctor_user)
    SurgeryConsent.objects.filter(surgery=surgery).update(status=SurgeryConsent.Status.DECLINED)
    declined = api_client.post(f"/api/v1/surgeries/{surgery.id}/mark-ready/")
    assert declined.status_code == status.HTTP_400_BAD_REQUEST

    SurgeryConsent.objects.filter(surgery=surgery).update(status=SurgeryConsent.Status.CONFIRMED)
    ready = api_client.post(f"/api/v1/surgeries/{surgery.id}/mark-ready/")
    assert ready.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_nurse_can_update_checklist_but_cannot_grant_readiness(api_client, nurse_user, doctor_user, surgery):
    item = PreoperativeChecklistItem.objects.create(name="Identity verification", is_required=True)
    api_client.force_authenticate(user=nurse_user)
    checklist = api_client.post(
        "/api/v1/preoperative-checklists/",
        {"surgery": surgery.id, "checklist_item": item.id, "status": "COMPLETED"},
        format="json",
    )
    readiness = api_client.post(
        "/api/v1/preoperative-assessments/",
        {"surgery": surgery.id, "readiness_status": "READY"},
        format="json",
    )
    assert checklist.status_code == status.HTTP_201_CREATED
    assert readiness.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_operative_record_doctor_required_and_completion_requires_record(api_client, doctor_user, nurse_user, surgery):
    surgery.status = Surgery.Status.IN_PROGRESS
    surgery.actual_start_at = timezone.now()
    surgery.save(update_fields=["status", "actual_start_at"])

    api_client.force_authenticate(user=nurse_user)
    forbidden = api_client.post(
        "/api/v1/operative-records/",
        {
            "surgery": surgery.id,
            "procedure_performed": "Procedure",
            "operative_findings": "Findings",
            "operative_technique": "Technique",
            "actual_start_at": surgery.actual_start_at.isoformat(),
            "immediate_postoperative_condition": "Stable",
        },
        format="json",
    )

    api_client.force_authenticate(user=doctor_user)
    missing_record = api_client.post(f"/api/v1/surgeries/{surgery.id}/complete/")
    assert forbidden.status_code == status.HTTP_403_FORBIDDEN
    assert missing_record.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_anesthesia_team_events_and_complications_validation(api_client, doctor_user, nurse_user, surgery):
    api_client.force_authenticate(user=doctor_user)
    anesthesia = api_client.post(
        "/api/v1/anesthesia-records/",
        {"surgery": surgery.id, "anesthesia_type": "GENERAL", "provider_name": "External provider"},
        format="json",
    )
    internal = api_client.post(
        "/api/v1/surgery-team-members/",
        {"surgery": surgery.id, "user": nurse_user.id, "role": "NURSE"},
        format="json",
    )
    external = api_client.post(
        "/api/v1/surgery-team-members/",
        {"surgery": surgery.id, "external_name": "Dr External", "role": "ANESTHESIA"},
        format="json",
    )
    invalid_team = api_client.post(
        "/api/v1/surgery-team-members/",
        {"surgery": surgery.id, "role": "OTHER"},
        format="json",
    )
    event = api_client.post(
        "/api/v1/intraoperative-events/",
        {"surgery": surgery.id, "event_type": "OBSERVATION", "description": "Incision started"},
        format="json",
    )
    bad_complication = api_client.post(
        "/api/v1/surgery-complications/",
        {
            "surgery": surgery.id,
            "complication_type": "Bleeding",
            "description": "Minor bleeding",
            "severity": "MINOR",
            "resolved": False,
            "resolved_at": timezone.now().isoformat(),
        },
        format="json",
    )
    complication = api_client.post(
        "/api/v1/surgery-complications/",
        {
            "surgery": surgery.id,
            "complication_type": "Bleeding",
            "description": "Minor bleeding",
            "severity": "MINOR",
            "action_taken": "Compression",
            "resolved": True,
            "resolved_at": timezone.now().isoformat(),
        },
        format="json",
    )

    assert anesthesia.status_code == status.HTTP_201_CREATED
    assert internal.status_code == status.HTTP_201_CREATED
    assert external.status_code == status.HTTP_201_CREATED
    assert invalid_team.status_code == status.HTTP_400_BAD_REQUEST
    assert event.status_code == status.HTTP_201_CREATED
    assert bad_complication.status_code == status.HTTP_400_BAD_REQUEST
    assert complication.status_code == status.HTTP_201_CREATED
    assert SurgeryTeamMember.objects.count() == 2
    assert IntraoperativeEvent.objects.count() == 1
    assert SurgeryComplication.objects.count() == 1


@pytest.mark.django_db
def test_postoperative_assessment_and_followup_doctor_authority(api_client, doctor_user, nurse_user, surgery):
    api_client.force_authenticate(user=doctor_user)
    assessment = api_client.post(
        "/api/v1/postoperative-assessments/",
        {
            "surgery": surgery.id,
            "general_condition": "Stable",
            "pain_score": 3,
            "wound_status": "Clean",
            "instructions": "Monitor",
        },
        format="json",
    )
    followup_one = api_client.post(
        "/api/v1/postoperative-follow-ups/",
        {
            "surgery": surgery.id,
            "patient": surgery.patient_id,
            "follow_up_date": timezone.now().isoformat(),
            "recovery_status": "Good",
        },
        format="json",
    )
    followup_two = api_client.post(
        "/api/v1/postoperative-follow-ups/",
        {
            "surgery": surgery.id,
            "patient": surgery.patient_id,
            "follow_up_date": (timezone.now() + timedelta(days=7)).isoformat(),
            "recovery_status": "Improving",
        },
        format="json",
    )

    api_client.force_authenticate(user=nurse_user)
    nurse_read = api_client.get(f"/api/v1/postoperative-assessments/{assessment.data['id']}/")
    forbidden = api_client.patch(
        f"/api/v1/postoperative-assessments/{assessment.data['id']}/",
        {"general_condition": "Changed"},
        format="json",
    )

    assert assessment.status_code == status.HTTP_201_CREATED
    assert followup_one.status_code == status.HTTP_201_CREATED
    assert followup_two.status_code == status.HTTP_201_CREATED
    assert nurse_read.status_code == status.HTTP_200_OK
    assert forbidden.status_code == status.HTTP_403_FORBIDDEN
    assert PostoperativeFollowUp.objects.filter(surgery=surgery).count() == 2


@pytest.mark.django_db
def test_followup_patient_consistency(api_client, doctor_user, surgery):
    other_patient = Patient.objects.create(first_name="Other", last_name="Mismatch")
    api_client.force_authenticate(user=doctor_user)
    response = api_client.post(
        "/api/v1/postoperative-follow-ups/",
        {
            "surgery": surgery.id,
            "patient": other_patient.id,
            "follow_up_date": timezone.now().isoformat(),
            "recovery_status": "Mismatch",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_care_prescription_and_instruction_can_reference_surgery(
    api_client,
    doctor_user,
    nurse_user,
    surgery,
):
    category = CareCategory.objects.create(name="Post-op care")
    care_type = CareType.objects.create(category=category, name="Dressing")
    api_client.force_authenticate(user=doctor_user)
    care = api_client.post(
        "/api/v1/cares/",
        {
            "patient": surgery.patient_id,
            "care_type": care_type.id,
            "assigned_nurse": nurse_user.id,
            "surgery": surgery.id,
            "start_date": timezone.localdate().isoformat(),
            "planned_sessions": 2,
            "price_per_session": "1000.00",
        },
        format="json",
    )
    prescription = api_client.post(
        "/api/v1/prescriptions/",
        {
            "patient": surgery.patient_id,
            "surgery": surgery.id,
            "prescribed_at": timezone.now().isoformat(),
            "status": "ACTIVE",
            "items": [{"medication_name": "Antibiotic", "dosage": "1g", "frequency": "Daily"}],
        },
        format="json",
    )
    instruction = api_client.post(
        "/api/v1/medical-instructions/",
        {
            "patient": surgery.patient_id,
            "surgery": surgery.id,
            "title": "Post-op instruction",
            "instruction": "Do not wet dressing",
            "priority": "HIGH",
            "status": "ACTIVE",
        },
        format="json",
    )

    assert care.status_code == status.HTTP_201_CREATED
    assert care.data["surgery"] == surgery.id
    assert care.data["total_price"] == "2000.00"
    assert prescription.status_code == status.HTTP_201_CREATED
    assert MedicalInstruction.objects.get(pk=instruction.data["id"]).surgery_id == surgery.id
    assert Care.objects.get(pk=care.data["id"]).surgery_id == surgery.id
    assert Prescription.objects.get(pk=prescription.data["id"]).surgery_id == surgery.id


@pytest.mark.django_db
def test_secretary_cannot_mutate_clinical_surgery_state(api_client, secretary_user, surgery):
    api_client.force_authenticate(user=secretary_user)
    before_status = surgery.status
    response = api_client.patch(
        f"/api/v1/surgeries/{surgery.id}/",
        {"procedure_name": "Changed by secretary"},
        format="json",
    )
    action = api_client.post(f"/api/v1/surgeries/{surgery.id}/plan/")
    surgery.refresh_from_db()
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert action.status_code == status.HTTP_403_FORBIDDEN
    assert surgery.status == before_status
    assert surgery.procedure_name == "Rhinoplasty"


@pytest.mark.django_db
def test_surgery_filtering_search_and_ordering(api_client, doctor_user, surgery):
    api_client.force_authenticate(user=doctor_user)
    listing = api_client.get(f"/api/v1/surgeries/?patient={surgery.patient_id}&search=Rhino&ordering=planned_date")
    assert listing.status_code == status.HTTP_200_OK
    assert listing.data["count"] == 1
    assert listing.data["results"][0]["id"] == surgery.id


@pytest.mark.django_db
def test_admin_can_manage_preoperative_checklist_configuration(api_client, admin_user, doctor_user, nurse_user):
    api_client.force_authenticate(user=admin_user)
    created = api_client.post(
        "/api/v1/preoperative-checklist-items/",
        {
            "name": "Phase 9K checklist item",
            "description": "Configuration item managed by admin",
            "category": "Administrative readiness",
            "is_required": True,
            "is_active": True,
            "sort_order": 50,
        },
        format="json",
    )

    assert created.status_code == status.HTTP_201_CREATED
    item_id = created.data["id"]
    assert AuditLog.objects.filter(action="PREOP_CHECKLIST_ITEM_CREATED", entity_id=str(item_id)).exists()

    updated = api_client.patch(
        f"/api/v1/preoperative-checklist-items/{item_id}/",
        {"is_active": False},
        format="json",
    )
    assert updated.status_code == status.HTTP_200_OK
    assert updated.data["is_active"] is False

    api_client.force_authenticate(user=doctor_user)
    doctor_update = api_client.patch(
        f"/api/v1/preoperative-checklist-items/{item_id}/",
        {"is_active": True},
        format="json",
    )
    assert doctor_update.status_code == status.HTTP_200_OK

    api_client.force_authenticate(user=nurse_user)
    nurse_update = api_client.patch(
        f"/api/v1/preoperative-checklist-items/{item_id}/",
        {"is_active": False},
        format="json",
    )
    assert nurse_update.status_code == status.HTTP_403_FORBIDDEN
    assert PreoperativeChecklistItem.objects.get(pk=item_id).is_active is True
