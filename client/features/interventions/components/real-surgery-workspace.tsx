"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { ModuleSummary } from "@/components/ui/module-summary";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAgendaStaff } from "@/features/agenda/services/agenda-service";
import type { AgendaStaff } from "@/features/agenda/types";
import { listConsultations } from "@/features/medical/services/consultation-service";
import type { Consultation } from "@/features/medical/types";
import { getPatient, listPatients } from "@/features/patients/services/patient-service";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import type {
  AnesthesiaRecordApi,
  InterventionTypeApi,
  IntraoperativeEventApi,
  PostoperativeAssessmentApi,
  PostoperativeFollowUpApi,
  PreoperativeAssessmentApi,
  PreoperativeChecklistItemApi,
  PreoperativeRequirementApi,
  SurgeryAnesthesiaType,
  SurgeryApi,
  SurgeryComplicationApi,
  SurgeryConsentApi,
  SurgeryLaterality,
  SurgeryOperativeRecordApi,
  SurgeryPayload,
  SurgeryPreoperativeChecklistApi,
  SurgeryPriority,
  SurgeryStatus,
  SurgeryTeamMemberApi,
} from "../api-types";
import {
  anesthesiaLabels,
  dateInput,
  dateTime,
  patientName,
  staffName,
  statusTone,
  surgeryErrorMessage,
  surgeryPatient,
  surgeryPriorityLabels,
  surgeryStatusLabels,
  toIsoFromLocalInput,
} from "../services/surgery-display";
import {
  beginPreopSurgery,
  cancelSurgery,
  completeSurgery,
  createAnesthesiaRecord,
  createIntraoperativeEvent,
  createOperativeRecord,
  createPostoperativeAssessment,
  createPostoperativeFollowUp,
  createPreoperativeAssessment,
  createPreoperativeChecklist,
  createPreoperativeRequirement,
  createSurgery,
  createSurgeryComplication,
  createSurgeryConsent,
  createSurgeryTeamMember,
  getSurgery,
  listInterventionTypes,
  listAnesthesiaRecords,
  listIntraoperativeEvents,
  listOperativeRecords,
  listPostoperativeAssessments,
  listPostoperativeFollowUps,
  listPreoperativeAssessments,
  listPreoperativeChecklistItems,
  listPreoperativeChecklists,
  listPreoperativeRequirements,
  listSurgeries,
  listSurgeryComplications,
  listSurgeryConsents,
  listSurgeryTeamMembers,
  markSurgeryReady,
  planSurgery,
  startSurgery,
  updateAnesthesiaRecord,
  updateOperativeRecord,
  updatePreoperativeAssessment,
  updatePreoperativeChecklist,
  updatePreoperativeRequirement,
  updateSurgery,
  updateSurgeryConsent,
} from "../services/surgery-api-service";
import styles from "./interventions.module.css";

const surgeryStatuses: Array<SurgeryStatus | ""> = ["", "DRAFT", "PLANNED", "PREOP_IN_PROGRESS", "READY", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const priorities: SurgeryPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const anesthesiaTypes: SurgeryAnesthesiaType[] = ["LOCAL", "REGIONAL", "SEDATION", "GENERAL", "OTHER"];
const lateralityOptions: Array<SurgeryLaterality | ""> = ["", "LEFT", "RIGHT", "BILATERAL", "MIDLINE", "NOT_APPLICABLE"];

interface SurgeryDetailState {
  assessment: PreoperativeAssessmentApi | null;
  checklistItems: PreoperativeChecklistItemApi[];
  checklists: SurgeryPreoperativeChecklistApi[];
  requirements: PreoperativeRequirementApi[];
  consents: SurgeryConsentApi[];
  anesthesia: AnesthesiaRecordApi | null;
  operative: SurgeryOperativeRecordApi | null;
  team: SurgeryTeamMemberApi[];
  events: IntraoperativeEventApi[];
  complications: SurgeryComplicationApi[];
  postopAssessments: PostoperativeAssessmentApi[];
  followUps: PostoperativeFollowUpApi[];
}

const emptyDetail: SurgeryDetailState = {
  assessment: null,
  checklistItems: [],
  checklists: [],
  requirements: [],
  consents: [],
  anesthesia: null,
  operative: null,
  team: [],
  events: [],
  complications: [],
  postopAssessments: [],
  followUps: [],
};

function localNowInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function surgeryLabel(surgery: SurgeryApi) {
  return surgery.intervention_type_name || surgery.procedure_name;
}

function SurgeryForm({
  surgery,
  patients,
  interventionTypes,
  onCancel,
  onSave,
}: {
  surgery?: SurgeryApi;
  patients: Patient[];
  interventionTypes: InterventionTypeApi[];
  onCancel: () => void;
  onSave: (payload: SurgeryPayload) => Promise<void>;
}) {
  const [patientId, setPatientId] = useState(surgery?.patient ?? patients[0]?.apiId ?? 0);
  const [interventionTypeId, setInterventionTypeId] = useState(surgery?.intervention_type ?? (surgery ? 0 : interventionTypes[0]?.id ?? 0));
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasLegacyProcedure = Boolean(surgery && !surgery.intervention_type && surgery.procedure_name);
  const availableInterventionTypes = surgery?.intervention_type && !interventionTypes.some((type) => type.id === surgery.intervention_type)
    ? [
        {
          id: surgery.intervention_type,
          name: surgery.intervention_type_name || surgery.procedure_name,
          code: surgery.intervention_type_code || surgery.procedure_code,
          description: surgery.procedure_description,
          is_active: true,
          created_at: surgery.created_at,
          updated_at: surgery.updated_at,
        },
        ...interventionTypes,
      ]
    : interventionTypes;
  const selectedInterventionTypeId = interventionTypeId || (surgery ? 0 : availableInterventionTypes[0]?.id ?? 0);

  useEffect(() => {
    if (!patientId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      listConsultations({ patient: patientId, ordering: "-consultation_date" })
        .then((response) => {
          if (active) setConsultations(response.results);
        })
        .catch(() => {
          if (active) setConsultations([]);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [patientId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const indication = String(form.get("indication") ?? "").trim();
    if (!patientId || !indication || (!selectedInterventionTypeId && !hasLegacyProcedure)) {
      setError("Patient, type d'intervention et indication sont obligatoires.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload: SurgeryPayload = {
        patient: patientId,
        consultation: Number(form.get("consultation")) || null,
        intervention_type: selectedInterventionTypeId || null,
        indication,
        planned_date: toIsoFromLocalInput(form.get("planned_date")),
        priority: String(form.get("priority")) as SurgeryPriority,
        laterality: String(form.get("laterality")) as SurgeryLaterality | "",
        anatomical_site: String(form.get("anatomical_site") ?? "").trim(),
        anesthesia_type: String(form.get("anesthesia_type")) as SurgeryAnesthesiaType | "",
        notes: String(form.get("notes") ?? "").trim(),
      };
      if (!selectedInterventionTypeId && hasLegacyProcedure && surgery) {
        payload.procedure_name = surgery.procedure_name;
        payload.procedure_code = surgery.procedure_code;
        payload.procedure_description = surgery.procedure_description;
      }
      await onSave(payload);
    } catch (cause) {
      setError(surgeryErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={ui.form} onSubmit={submit}>
      <label>Patient
        <select value={patientId || ""} onChange={(event) => setPatientId(Number(event.target.value))} disabled={Boolean(surgery)} required>
          <option value="" disabled>Sélectionner un patient</option>
          {patients.map((patient) => <option key={patient.apiId} value={patient.apiId}>{patient.name}</option>)}
        </select>
      </label>
      <label>Consultation liée
        <select name="consultation" defaultValue={surgery?.consultation ?? ""}>
          <option value="">Aucune consultation</option>
          {consultations.map((consultation) => <option key={consultation.id} value={consultation.id}>{dateTime(consultation.consultation_date)} · {consultation.reason || consultation.consultation_type}</option>)}
        </select>
      </label>
      <label>Type d&apos;intervention
        <select value={selectedInterventionTypeId || ""} onChange={(event) => setInterventionTypeId(Number(event.target.value) || 0)} required={!hasLegacyProcedure}>
          <option value="" disabled={!hasLegacyProcedure}>{hasLegacyProcedure ? "Conserver intervention historique" : "Sélectionner un type"}</option>
          {availableInterventionTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </label>
      {hasLegacyProcedure && <p className={ui.empty}>Intervention historique: {surgery?.procedure_name}</p>}
      <label>Indication<textarea name="indication" defaultValue={surgery?.indication ?? ""} required /></label>
      <div className={ui.toolbar}>
        <label>Date planifiée<input name="planned_date" type="datetime-local" defaultValue={dateInput(surgery?.planned_date)} /></label>
        <label>Priorité<select name="priority" defaultValue={surgery?.priority ?? "NORMAL"}>{priorities.map((priority) => <option key={priority} value={priority}>{surgeryPriorityLabels[priority]}</option>)}</select></label>
      </div>
      <div className={ui.toolbar}>
        <label>Latéralité<select name="laterality" defaultValue={surgery?.laterality ?? ""}>{lateralityOptions.map((value) => <option key={value || "none"} value={value}>{value || "Non renseignée"}</option>)}</select></label>
        <label>Anesthésie<select name="anesthesia_type" defaultValue={surgery?.anesthesia_type ?? ""}><option value="">Non renseignée</option>{anesthesiaTypes.map((type) => <option key={type} value={type}>{anesthesiaLabels[type]}</option>)}</select></label>
      </div>
      <label>Site anatomique<input name="anatomical_site" defaultValue={surgery?.anatomical_site ?? ""} /></label>
      <label>Notes<textarea name="notes" defaultValue={surgery?.notes ?? ""} /></label>
      {error && <p role="alert">{error}</p>}
      <div className={ui.actions}>
        <button className={`${ui.action} ${ui.primary}`} disabled={busy || (!availableInterventionTypes.length && !hasLegacyProcedure)}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
        <button className={ui.action} type="button" disabled={busy} onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

export function RealSurgeryWorkspace() {
  const [surgeries, setSurgeries] = useState<SurgeryApi[]>([]);
  const [surgeryCount, setSurgeryCount] = useState(0);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<AgendaStaff[]>([]);
  const [interventionTypes, setInterventionTypes] = useState<InterventionTypeApi[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SurgeryDetailState>(emptyDetail);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SurgeryStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState<SurgeryApi | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = surgeries.find((surgery) => surgery.id === selectedId) ?? surgeries[0] ?? null;

  const loadSurgeries = useCallback(async () => {
    const response = await listSurgeries({ page, search, status, ordering: "-planned_date" });
    const patientIds = [...new Set(response.results.map((surgery) => surgery.patient))];
    const loadedPatients = await Promise.all(patientIds.map((id) => getPatient(String(id))));
    const patientPage = await listPatients({ ordering: "last_name" });
    const mergedPatients = [...patientPage.results, ...loadedPatients].filter((patient, index, values) => values.findIndex((item) => item.apiId === patient.apiId) === index);
    setPatients(mergedPatients);
    setSurgeries(response.results);
    setSurgeryCount(response.count);
    setSelectedId((current) => response.results.find((surgery) => surgery.id === current)?.id ?? response.results[0]?.id ?? null);
  }, [page, search, status]);

  const loadStatic = useCallback(async () => {
    const [staffMembers, interventionTypePage] = await Promise.all([
      listAgendaStaff(),
      listInterventionTypes({ is_active: true, ordering: "name" }),
    ]);
    setStaff(staffMembers);
    setInterventionTypes(interventionTypePage.results);
  }, []);

  const loadDetail = useCallback(async (surgeryId: number) => {
    const [
      checklistItems,
      assessments,
      checklists,
      requirements,
      consents,
      anesthesia,
      operative,
      team,
      events,
      complications,
      postopAssessments,
      followUps,
    ] = await Promise.all([
      listPreoperativeChecklistItems({ is_active: true, ordering: "sort_order" }),
      listPreoperativeAssessments({ surgery: surgeryId }),
      listPreoperativeChecklists({ surgery: surgeryId }),
      listPreoperativeRequirements({ surgery: surgeryId }),
      listSurgeryConsents({ surgery: surgeryId }),
      listAnesthesiaRecords({ surgery: surgeryId }),
      listOperativeRecords({ surgery: surgeryId }),
      listSurgeryTeamMembers({ surgery: surgeryId }),
      listIntraoperativeEvents({ surgery: surgeryId, ordering: "-occurred_at" }),
      listSurgeryComplications({ surgery: surgeryId, ordering: "-occurred_at" }),
      listPostoperativeAssessments({ surgery: surgeryId, ordering: "-assessed_at" }),
      listPostoperativeFollowUps({ surgery: surgeryId, ordering: "-follow_up_date" }),
    ]);
    setDetail({
      assessment: assessments.results[0] ?? null,
      checklistItems: checklistItems.results,
      checklists: checklists.results,
      requirements: requirements.results,
      consents: consents.results,
      anesthesia: anesthesia.results[0] ?? null,
      operative: operative.results[0] ?? null,
      team: team.results,
      events: events.results,
      complications: complications.results,
      postopAssessments: postopAssessments.results,
      followUps: followUps.results,
    });
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.all([loadStatic(), loadSurgeries()])
        .catch((cause) => {
          if (active) setError(surgeryErrorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadStatic, loadSurgeries]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setDetailLoading(true);
      loadDetail(selected.id)
        .catch((cause) => {
          if (active) setError(surgeryErrorMessage(cause));
        })
        .finally(() => {
          if (active) setDetailLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadDetail, selected]);

  async function refreshSelected() {
    if (!selected) return;
    const fresh = await getSurgery(selected.id);
    setSurgeries((current) => current.map((item) => item.id === fresh.id ? fresh : item));
    await loadDetail(fresh.id);
  }

  async function mutate(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await loadSurgeries();
      await refreshSelected();
      setMessage(success);
    } catch (cause) {
      setError(surgeryErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveSurgery(payload: SurgeryPayload) {
    const saved = editing === "new" ? await createSurgery(payload) : await updateSurgery((editing as SurgeryApi).id, payload);
    setEditing(null);
    setMessage(`Intervention ${surgeryLabel(saved)} enregistrée.`);
    await loadSurgeries();
    setSelectedId(saved.id);
  }

  async function saveAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      surgery: selected.id,
      medical_history_reviewed: form.get("medical_history_reviewed") === "on",
      allergies_reviewed: form.get("allergies_reviewed") === "on",
      medications_reviewed: form.get("medications_reviewed") === "on",
      contraindications_reviewed: form.get("contraindications_reviewed") === "on",
      fasting_status: String(form.get("fasting_status")) as PreoperativeAssessmentApi["fasting_status"],
      anesthesia_evaluation_status: String(form.get("anesthesia_evaluation_status")) as PreoperativeAssessmentApi["anesthesia_evaluation_status"],
      required_tests_reviewed: form.get("required_tests_reviewed") === "on",
      pregnancy_status: String(form.get("pregnancy_status")) as PreoperativeAssessmentApi["pregnancy_status"],
      readiness_status: String(form.get("readiness_status")) as PreoperativeAssessmentApi["readiness_status"],
      assessment_notes: String(form.get("assessment_notes") ?? "").trim(),
    };
    await mutate(() => detail.assessment ? updatePreoperativeAssessment(detail.assessment.id, payload) : createPreoperativeAssessment(payload), "Évaluation préopératoire enregistrée.");
  }

  async function saveChecklist(item: PreoperativeChecklistItemApi, statusValue: SurgeryPreoperativeChecklistApi["status"]) {
    if (!selected) return;
    const existing = detail.checklists.find((check) => check.checklist_item === item.id);
    await mutate(
      () => existing
        ? updatePreoperativeChecklist(existing.id, { surgery: selected.id, checklist_item: item.id, status: statusValue, notes: existing.notes })
        : createPreoperativeChecklist({ surgery: selected.id, checklist_item: item.id, status: statusValue }),
      "Checklist mise à jour.",
    );
  }

  async function addRequirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(() => createPreoperativeRequirement({
      surgery: selected.id,
      name: String(form.get("name") ?? "").trim(),
      requirement_type: String(form.get("requirement_type")) as PreoperativeRequirementApi["requirement_type"],
      required: form.get("required") === "on",
      status: String(form.get("status")) as PreoperativeRequirementApi["status"],
      result_summary: String(form.get("result_summary") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    }), "Exigence préopératoire ajoutée.");
    event.currentTarget.reset();
  }

  async function updateRequirementStatus(requirement: PreoperativeRequirementApi, statusValue: PreoperativeRequirementApi["status"]) {
    await mutate(() => updatePreoperativeRequirement(requirement.id, { surgery: requirement.surgery, name: requirement.name, status: statusValue }), "Exigence mise à jour.");
  }

  async function addConsent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(() => createSurgeryConsent({
      surgery: selected.id,
      consent_type: String(form.get("consent_type") ?? "").trim(),
      required: form.get("required") === "on",
      status: String(form.get("status")) as SurgeryConsentApi["status"],
      notes: String(form.get("notes") ?? "").trim(),
    }), "Consentement enregistré.");
    event.currentTarget.reset();
  }

  async function updateConsentStatus(consent: SurgeryConsentApi, statusValue: SurgeryConsentApi["status"]) {
    await mutate(() => updateSurgeryConsent(consent.id, { surgery: consent.surgery, consent_type: consent.consent_type, status: statusValue }), "Consentement mis à jour.");
  }

  async function saveAnesthesia(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      surgery: selected.id,
      anesthesia_type: String(form.get("anesthesia_type")) as SurgeryAnesthesiaType,
      provider_name: String(form.get("provider_name") ?? "").trim(),
      pre_anesthesia_notes: String(form.get("pre_anesthesia_notes") ?? "").trim(),
      intraoperative_notes: String(form.get("intraoperative_notes") ?? "").trim(),
      post_anesthesia_notes: String(form.get("post_anesthesia_notes") ?? "").trim(),
      complications: String(form.get("complications") ?? "").trim(),
    };
    await mutate(() => detail.anesthesia ? updateAnesthesiaRecord(detail.anesthesia.id, payload) : createAnesthesiaRecord(payload), "Anesthésie enregistrée.");
  }

  async function saveOperative(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const actualStart = toIsoFromLocalInput(form.get("actual_start_at"));
    if (!actualStart) {
      setError("Heure de début opératoire obligatoire.");
      return;
    }
    const payload = {
      surgery: selected.id,
      procedure_performed: String(form.get("procedure_performed") ?? "").trim(),
      operative_findings: String(form.get("operative_findings") ?? "").trim(),
      operative_technique: String(form.get("operative_technique") ?? "").trim(),
      actual_start_at: actualStart,
      actual_end_at: toIsoFromLocalInput(form.get("actual_end_at")),
      anesthesia_type: String(form.get("anesthesia_type")) as SurgeryAnesthesiaType | "",
      estimated_blood_loss: String(form.get("estimated_blood_loss") ?? "").trim(),
      complications: String(form.get("complications") ?? "").trim(),
      specimens: String(form.get("specimens") ?? "").trim(),
      drains: String(form.get("drains") ?? "").trim(),
      implants_or_devices: String(form.get("implants_or_devices") ?? "").trim(),
      immediate_postoperative_condition: String(form.get("immediate_postoperative_condition") ?? "").trim(),
      operative_notes: String(form.get("operative_notes") ?? "").trim(),
    };
    await mutate(() => detail.operative ? updateOperativeRecord(detail.operative.id, payload) : createOperativeRecord(payload), "Compte-rendu opératoire enregistré.");
  }

  async function addTeamMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(() => createSurgeryTeamMember({
      surgery: selected.id,
      user: Number(form.get("user")) || null,
      external_name: String(form.get("external_name") ?? "").trim(),
      role: String(form.get("role")) as SurgeryTeamMemberApi["role"],
      notes: String(form.get("notes") ?? "").trim(),
    }), "Membre d’équipe ajouté.");
    event.currentTarget.reset();
  }

  async function addEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(() => createIntraoperativeEvent({
      surgery: selected.id,
      event_type: String(form.get("event_type")) as IntraoperativeEventApi["event_type"],
      description: String(form.get("description") ?? "").trim(),
      occurred_at: toIsoFromLocalInput(form.get("occurred_at")) ?? new Date().toISOString(),
      severity: String(form.get("severity")) as IntraoperativeEventApi["severity"],
    }), "Événement intraopératoire enregistré.");
    event.currentTarget.reset();
  }

  async function addComplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const resolved = form.get("resolved") === "on";
    await mutate(() => createSurgeryComplication({
      surgery: selected.id,
      complication_type: String(form.get("complication_type") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      severity: String(form.get("severity")) as SurgeryComplicationApi["severity"],
      occurred_at: toIsoFromLocalInput(form.get("occurred_at")) ?? new Date().toISOString(),
      action_taken: String(form.get("action_taken") ?? "").trim(),
      resolved,
      resolved_at: resolved ? (toIsoFromLocalInput(form.get("resolved_at")) ?? new Date().toISOString()) : null,
      notes: String(form.get("notes") ?? "").trim(),
    }), "Complication enregistrée.");
    event.currentTarget.reset();
  }

  async function addPostopAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(() => createPostoperativeAssessment({
      surgery: selected.id,
      assessed_at: toIsoFromLocalInput(form.get("assessed_at")) ?? new Date().toISOString(),
      general_condition: String(form.get("general_condition") ?? "").trim(),
      pain_score: Number(form.get("pain_score")) || null,
      consciousness_status: String(form.get("consciousness_status") ?? "").trim(),
      wound_status: String(form.get("wound_status") ?? "").trim(),
      bleeding_status: String(form.get("bleeding_status") ?? "").trim(),
      drain_status: String(form.get("drain_status") ?? "").trim(),
      nausea_vomiting: String(form.get("nausea_vomiting") ?? "").trim(),
      complications: String(form.get("complications") ?? "").trim(),
      instructions: String(form.get("instructions") ?? "").trim(),
      disposition: String(form.get("disposition") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    }), "Évaluation postopératoire enregistrée.");
    event.currentTarget.reset();
  }

  async function addFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(() => createPostoperativeFollowUp({
      surgery: selected.id,
      patient: selected.patient,
      follow_up_date: toIsoFromLocalInput(form.get("follow_up_date")) ?? new Date().toISOString(),
      recovery_status: String(form.get("recovery_status") ?? "").trim(),
      wound_assessment: String(form.get("wound_assessment") ?? "").trim(),
      pain_score: Number(form.get("pain_score")) || null,
      complications: String(form.get("complications") ?? "").trim(),
      clinical_findings: String(form.get("clinical_findings") ?? "").trim(),
      recommendations: String(form.get("recommendations") ?? "").trim(),
      next_follow_up_date: toIsoFromLocalInput(form.get("next_follow_up_date")),
      notes: String(form.get("notes") ?? "").trim(),
    }), "Suivi postopératoire enregistré.");
    event.currentTarget.reset();
  }

  const pages = Math.max(1, Math.ceil(surgeryCount / 10));
  const selectedPatient = selected ? surgeryPatient(selected, patients) : undefined;
  const selectedSurgeon = staff.find((member) => member.id === selected?.surgeon);
  const readyChecks = detail.checklistItems.filter((item) => item.is_required).map((item) => detail.checklists.find((check) => check.checklist_item === item.id)?.status ?? "PENDING");

  return (
    <main className={ui.page}>
      <header className={ui.heading}>
        <div>
          <h1 className={ui.title}>Interventions</h1>
          <p className={ui.description}>Planification chirurgicale, préopératoire, bloc et suivi postopératoire réels.</p>
        </div>
        <button className={`${ui.action} ${ui.primary}`} onClick={() => setEditing("new")}>Nouvelle intervention</button>
      </header>
      <ModuleSummary items={[
        { label: "Interventions", value: `${surgeryCount} dossiers` },
        { label: "Préopératoire", value: `${surgeries.filter((item) => item.status === "PREOP_IN_PROGRESS").length} en cours` },
        { label: "Bloc", value: `${surgeries.filter((item) => item.status === "IN_PROGRESS").length} au bloc` },
      ]} />
      {error && <p className={ui.panel} role="alert">{error}</p>}
      {message && <p className={ui.panel} role="status">{message}</p>}
      <div className={ui.toolbar}>
        <label className={ui.search}><span className="sr-only">Rechercher</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Patient, intervention, site..." /></label>
        <div className={ui.actions}>
          <label className={styles.filter}>Statut<select value={status} onChange={(event) => { setStatus(event.target.value as SurgeryStatus | ""); setPage(1); }}>{surgeryStatuses.map((item) => <option key={item || "all"} value={item}>{item ? surgeryStatusLabels[item] : "Tous"}</option>)}</select></label>
          <button className={ui.action} onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>Réinitialiser</button>
        </div>
      </div>
      {loading ? <p className={ui.panel} role="status">Chargement des interventions...</p> : (
        <div className={styles.columns}>
          <section className={ui.tableScroll}>
            <h2 className={styles.sectionTitle}>Programme opératoire <small>{surgeryCount} dossiers</small></h2>
            <table className={`${ui.table} ${styles.table}`}>
              <thead><tr><th>Date</th><th>Patient</th><th>Intervention</th><th>Chirurgien</th></tr></thead>
              <tbody>{surgeries.map((surgery) => {
                const patient = surgeryPatient(surgery, patients);
                const surgeon = staff.find((member) => member.id === surgery.surgeon);
                return (
                  <tr key={surgery.id} data-selected={surgery.id === selected?.id}>
                    <td>{dateTime(surgery.planned_date)}<small>{surgeryStatusLabels[surgery.status]}</small></td>
                    <td><button className={styles.patient} onClick={() => setSelectedId(surgery.id)}>{patientName(patient)}</button><small>{surgery.anatomical_site || surgeryStatusLabels[surgery.status]}</small></td>
                    <td>{surgeryLabel(surgery)}<small>{surgery.anatomical_site || surgeryStatusLabels[surgery.status]}</small></td>
                    <td>{staffName(surgeon)}<small>{surgery.anesthesia_type ? anesthesiaLabels[surgery.anesthesia_type] : "Anesthésie non renseignée"}</small></td>
                  </tr>
                );
              })}</tbody>
            </table>
            {!surgeries.length && <p className={ui.empty}>Aucune intervention trouvée.</p>}
            <footer className={ui.footer}><span>Page {page} / {pages}</span><div className={ui.actions}><button className={ui.action} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Précédent</button><button className={ui.action} disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Suivant</button></div></footer>
          </section>
          {selected && (
            <aside className={ui.panel} aria-label="Fiche d’intervention">
              <div className={ui.actions}><p className={ui.eyebrow}>Fiche d’intervention</p><StatusBadge tone={statusTone(selected.status)}>{surgeryStatusLabels[selected.status]}</StatusBadge></div>
              <h2>{surgeryLabel(selected)}</h2>
              <p>{patientName(selectedPatient)} · {staffName(selectedSurgeon)}</p>
              {selectedPatient && <Link href={`/patients/${selectedPatient.patientReference}`} className={styles.record}>Dossier patient</Link>}
              <div className={styles.path}><span>Brouillon</span><span>Planifiée</span><strong>Pré-op</strong><span>Bloc</span><span>Post-op</span></div>
              <dl className={styles.details}>
                <dt>Date planifiée</dt><dd>{dateTime(selected.planned_date)}</dd>
                <dt>Indication</dt><dd>{selected.indication}</dd>
                <dt>Anesthésie</dt><dd>{selected.anesthesia_type ? anesthesiaLabels[selected.anesthesia_type] : "Non renseignée"}</dd>
                <dt>Priorité</dt><dd>{surgeryPriorityLabels[selected.priority]}</dd>
                <dt>Consultation</dt><dd>{selected.consultation ? "Consultation liée à l’intervention" : "Non liée"}</dd>
              </dl>
              <div className={ui.actions}>
                <button className={ui.action} disabled={busy} onClick={() => setEditing(selected)}>Modifier</button>
                {selected.status === "DRAFT" && <button className={ui.action} disabled={busy} onClick={() => mutate(() => planSurgery(selected.id), "Intervention planifiée.")}>Planifier</button>}
                {selected.status === "PLANNED" && <button className={ui.action} disabled={busy} onClick={() => mutate(() => beginPreopSurgery(selected.id), "Préopératoire démarré.")}>Démarrer pré-op</button>}
                {["PREOP_IN_PROGRESS", "READY"].includes(selected.status) && <button className={ui.action} disabled={busy} onClick={() => mutate(() => markSurgeryReady(selected.id), "Readiness validée.")}>Marquer prête</button>}
                {selected.status === "READY" && <button className={ui.action} disabled={busy} onClick={() => mutate(() => startSurgery(selected.id), "Intervention démarrée.")}>Démarrer bloc</button>}
                {selected.status === "IN_PROGRESS" && <button className={ui.action} disabled={busy} onClick={() => mutate(() => completeSurgery(selected.id), "Intervention terminée.")}>Terminer</button>}
                {["DRAFT", "PLANNED", "PREOP_IN_PROGRESS", "READY"].includes(selected.status) && <button className={ui.action} disabled={busy} onClick={() => { const reason = window.prompt("Motif d’annulation"); if (reason) void mutate(() => cancelSurgery(selected.id, reason), "Intervention annulée."); }}>Annuler</button>}
              </div>
              {detailLoading ? <p role="status">Chargement du workflow...</p> : (
                <div>
                  <h3>Préopératoire</h3>
                  <form className={ui.form} onSubmit={saveAssessment}>
                    <div className={ui.actions}>
                      {["medical_history_reviewed", "allergies_reviewed", "medications_reviewed", "contraindications_reviewed", "required_tests_reviewed"].map((field) => <label key={field}><input name={field} type="checkbox" defaultChecked={Boolean(detail.assessment?.[field as keyof PreoperativeAssessmentApi])} /> {field.replace(/_/g, " ")}</label>)}
                    </div>
                    <label>Jeûne<select name="fasting_status" defaultValue={detail.assessment?.fasting_status ?? "UNKNOWN"}>{["UNKNOWN", "CONFIRMED", "NOT_FASTED", "NOT_REQUIRED"].map((value) => <option key={value}>{value}</option>)}</select></label>
                    <label>Évaluation anesthésie<select name="anesthesia_evaluation_status" defaultValue={detail.assessment?.anesthesia_evaluation_status ?? "PENDING"}>{["PENDING", "CLEARED", "NEEDS_REVIEW", "NOT_REQUIRED"].map((value) => <option key={value}>{value}</option>)}</select></label>
                    <label>Grossesse<select name="pregnancy_status" defaultValue={detail.assessment?.pregnancy_status ?? "NOT_APPLICABLE"}>{["NOT_APPLICABLE", "UNKNOWN", "NEGATIVE", "POSITIVE"].map((value) => <option key={value}>{value}</option>)}</select></label>
                    <label>Readiness<select name="readiness_status" defaultValue={detail.assessment?.readiness_status ?? "PENDING"}>{["PENDING", "NEEDS_REVIEW", "READY", "NOT_READY"].map((value) => <option key={value}>{value}</option>)}</select></label>
                    <label>Notes<textarea name="assessment_notes" defaultValue={detail.assessment?.assessment_notes ?? ""} /></label>
                    <button className={ui.action} disabled={busy}>Enregistrer évaluation</button>
                  </form>
                  <h3>Checklist</h3>
                  {detail.checklistItems.length ? <ul className={styles.checklist}>{detail.checklistItems.map((item) => {
                    const check = detail.checklists.find((value) => value.checklist_item === item.id);
                    const checkStatus = check?.status ?? "PENDING";
                    return <li key={item.id} data-warning={checkStatus === "BLOCKED"}><span>{checkStatus === "COMPLETED" ? "✓" : "○"}</span>{item.name}<select value={checkStatus} disabled={busy} onChange={(event) => saveChecklist(item, event.target.value as SurgeryPreoperativeChecklistApi["status"])}>{["PENDING", "COMPLETED", "NOT_APPLICABLE", "BLOCKED"].map((value) => <option key={value}>{value}</option>)}</select></li>;
                  })}</ul> : <p>Aucun item actif configuré.</p>}
                  <small>Items requis satisfaits: {readyChecks.filter((value) => value === "COMPLETED" || value === "NOT_APPLICABLE").length}/{readyChecks.length}</small>
                  <h3>Exigences</h3>
                  <form className={ui.form} onSubmit={addRequirement}><input name="name" placeholder="Nom exigence" required /><select name="requirement_type">{["LAB", "IMAGING", "ANESTHESIA", "MEDICAL_CLEARANCE", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select><select name="status">{["PENDING", "SATISFIED", "BLOCKED", "WAIVED"].map((value) => <option key={value}>{value}</option>)}</select><label><input name="required" type="checkbox" defaultChecked /> Obligatoire</label><textarea name="result_summary" placeholder="Résumé résultat" /><textarea name="notes" placeholder="Notes" /><button className={ui.action} disabled={busy}>Ajouter exigence</button></form>
                  {detail.requirements.map((requirement) => <p key={requirement.id}>{requirement.name} · <select value={requirement.status} disabled={busy} onChange={(event) => updateRequirementStatus(requirement, event.target.value as PreoperativeRequirementApi["status"])}>{["PENDING", "SATISFIED", "BLOCKED", "WAIVED"].map((value) => <option key={value}>{value}</option>)}</select></p>)}
                  <h3>Consentements</h3>
                  <form className={ui.form} onSubmit={addConsent}><input name="consent_type" placeholder="Type de consentement" required /><select name="status">{["PENDING", "CONFIRMED", "DECLINED", "REVOKED"].map((value) => <option key={value}>{value}</option>)}</select><label><input name="required" type="checkbox" defaultChecked /> Obligatoire</label><textarea name="notes" placeholder="Notes" /><button className={ui.action} disabled={busy}>Ajouter consentement</button></form>
                  {detail.consents.map((consent) => <p key={consent.id}>{consent.consent_type} · <select value={consent.status} disabled={busy} onChange={(event) => updateConsentStatus(consent, event.target.value as SurgeryConsentApi["status"])}>{["PENDING", "CONFIRMED", "DECLINED", "REVOKED"].map((value) => <option key={value}>{value}</option>)}</select></p>)}
                  <h3>Anesthésie</h3>
                  <form className={ui.form} onSubmit={saveAnesthesia}><select name="anesthesia_type" defaultValue={detail.anesthesia?.anesthesia_type ?? selected.anesthesia_type ?? "GENERAL"}>{anesthesiaTypes.map((type) => <option key={type} value={type}>{anesthesiaLabels[type]}</option>)}</select><input name="provider_name" placeholder="Intervenant" defaultValue={detail.anesthesia?.provider_name ?? ""} /><textarea name="pre_anesthesia_notes" placeholder="Pré-anesthésie" defaultValue={detail.anesthesia?.pre_anesthesia_notes ?? ""} /><textarea name="intraoperative_notes" placeholder="Notes intraopératoires" defaultValue={detail.anesthesia?.intraoperative_notes ?? ""} /><textarea name="post_anesthesia_notes" placeholder="Post-anesthésie" defaultValue={detail.anesthesia?.post_anesthesia_notes ?? ""} /><textarea name="complications" placeholder="Complications anesthésie" defaultValue={detail.anesthesia?.complications ?? ""} /><button className={ui.action} disabled={busy}>Enregistrer anesthésie</button></form>
                  <h3>Compte-rendu opératoire</h3>
                  <form className={ui.form} onSubmit={saveOperative}><input name="procedure_performed" placeholder="Acte réalisé" defaultValue={detail.operative?.procedure_performed ?? selected.procedure_name} required /><textarea name="operative_findings" placeholder="Constatations" defaultValue={detail.operative?.operative_findings ?? ""} required /><textarea name="operative_technique" placeholder="Technique" defaultValue={detail.operative?.operative_technique ?? ""} required /><input name="actual_start_at" type="datetime-local" defaultValue={dateInput(detail.operative?.actual_start_at ?? selected.actual_start_at) || localNowInput()} required /><input name="actual_end_at" type="datetime-local" defaultValue={dateInput(detail.operative?.actual_end_at)} /><select name="anesthesia_type" defaultValue={detail.operative?.anesthesia_type ?? selected.anesthesia_type ?? ""}><option value="">Non renseignée</option>{anesthesiaTypes.map((type) => <option key={type} value={type}>{anesthesiaLabels[type]}</option>)}</select><input name="estimated_blood_loss" placeholder="Pertes sanguines" defaultValue={detail.operative?.estimated_blood_loss ?? ""} /><textarea name="complications" placeholder="Complications" defaultValue={detail.operative?.complications ?? ""} /><textarea name="specimens" placeholder="Prélèvements" defaultValue={detail.operative?.specimens ?? ""} /><textarea name="drains" placeholder="Drains" defaultValue={detail.operative?.drains ?? ""} /><textarea name="implants_or_devices" placeholder="Implants/dispositifs" defaultValue={detail.operative?.implants_or_devices ?? ""} /><textarea name="immediate_postoperative_condition" placeholder="État postopératoire immédiat" defaultValue={detail.operative?.immediate_postoperative_condition ?? ""} required /><textarea name="operative_notes" placeholder="Notes" defaultValue={detail.operative?.operative_notes ?? ""} /><button className={ui.action} disabled={busy}>Enregistrer opératoire</button></form>
                  <h3>Équipe</h3>
                  <form className={ui.form} onSubmit={addTeamMember}><select name="user"><option value="">Externe / non renseigné</option>{staff.map((member) => <option key={member.id} value={member.id}>{staffName(member)} · {member.role}</option>)}</select><input name="external_name" placeholder="Nom externe" /><select name="role">{["SURGEON", "ASSISTANT", "NURSE", "ANESTHESIA", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select><textarea name="notes" placeholder="Notes" /><button className={ui.action} disabled={busy}>Ajouter équipe</button></form>
                  {detail.team.map((member) => <p key={member.id}>{member.role} · {staffName(staff.find((item) => item.id === member.user)) || member.external_name}{member.external_name ? ` · ${member.external_name}` : ""}</p>)}
                  <h3>Événements & complications</h3>
                  <form className={ui.form} onSubmit={addEvent}><select name="event_type">{["MEDICATION", "COMPLICATION", "OBSERVATION", "DEVICE", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select><input name="occurred_at" type="datetime-local" defaultValue={localNowInput()} /><select name="severity"><option value="">Sans sévérité</option>{["LOW", "MODERATE", "HIGH", "CRITICAL"].map((value) => <option key={value}>{value}</option>)}</select><textarea name="description" placeholder="Description" required /><button className={ui.action} disabled={busy}>Ajouter événement</button></form>
                  {detail.events.map((event) => <p key={event.id}>{dateTime(event.occurred_at)} · {event.event_type} · {event.description}</p>)}
                  <form className={ui.form} onSubmit={addComplication}><input name="complication_type" placeholder="Type complication" required /><select name="severity">{["MINOR", "MODERATE", "SEVERE", "CRITICAL"].map((value) => <option key={value}>{value}</option>)}</select><input name="occurred_at" type="datetime-local" defaultValue={localNowInput()} /><textarea name="description" placeholder="Description" required /><textarea name="action_taken" placeholder="Action" /><label><input name="resolved" type="checkbox" /> Résolue</label><input name="resolved_at" type="datetime-local" /><textarea name="notes" placeholder="Notes" /><button className={ui.action} disabled={busy}>Ajouter complication</button></form>
                  {detail.complications.map((complication) => <p key={complication.id}>{complication.complication_type} · {complication.severity} · {complication.resolved ? "résolue" : "active"}</p>)}
                  <h3>Postopératoire</h3>
                  <form className={ui.form} onSubmit={addPostopAssessment}><input name="assessed_at" type="datetime-local" defaultValue={localNowInput()} /><textarea name="general_condition" placeholder="État général" required /><input name="pain_score" type="number" min={0} max={10} placeholder="Douleur /10" /><input name="consciousness_status" placeholder="Conscience" /><textarea name="wound_status" placeholder="Plaie" /><input name="bleeding_status" placeholder="Saignement" /><input name="drain_status" placeholder="Drains" /><input name="nausea_vomiting" placeholder="Nausées/vomissements" /><textarea name="complications" placeholder="Complications" /><textarea name="instructions" placeholder="Instructions" /><input name="disposition" placeholder="Disposition" /><textarea name="notes" placeholder="Notes" /><button className={ui.action} disabled={busy}>Ajouter évaluation postop</button></form>
                  {detail.postopAssessments.map((assessment) => <p key={assessment.id}>{dateTime(assessment.assessed_at)} · douleur {assessment.pain_score ?? "—"} · {assessment.general_condition}</p>)}
                  <form className={ui.form} onSubmit={addFollowUp}><input name="follow_up_date" type="datetime-local" defaultValue={localNowInput()} /><input name="recovery_status" placeholder="Récupération" required /><textarea name="wound_assessment" placeholder="Plaie" /><input name="pain_score" type="number" min={0} max={10} placeholder="Douleur /10" /><textarea name="complications" placeholder="Complications" /><textarea name="clinical_findings" placeholder="Constatations" /><textarea name="recommendations" placeholder="Recommandations" /><input name="next_follow_up_date" type="datetime-local" /><textarea name="notes" placeholder="Notes" /><button className={ui.action} disabled={busy}>Ajouter suivi</button></form>
                  {detail.followUps.map((followUp) => <p key={followUp.id}>{dateTime(followUp.follow_up_date)} · {followUp.recovery_status}</p>)}
                </div>
              )}
            </aside>
          )}
        </div>
      )}
      <DetailDialog title={editing === "new" ? "Nouvelle intervention" : "Modifier intervention"} open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && <SurgeryForm surgery={editing === "new" ? undefined : editing} patients={patients} interventionTypes={interventionTypes} onCancel={() => setEditing(null)} onSave={saveSurgery} />}
      </DetailDialog>
    </main>
  );
}
