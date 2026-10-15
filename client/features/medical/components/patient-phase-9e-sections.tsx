"use client";

import { CreateWorkLeaveButton } from "@/features/work-leaves/components/create-work-leave-button";
import { PrescriptionActions } from "@/features/prescriptions/components/prescription-actions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import { PrescriptionEditor } from "@/features/prescriptions/components/prescription-editor";
import { prescriptionService } from "@/features/prescriptions/services/prescription-service";
import type { Prescription, PrescriptionPayload, PrescriptionStatus } from "@/features/prescriptions/types";
import type { Patient } from "@/features/patients/types";
import { consultationService } from "../services/consultation-service";
import { medicalErrorMessage } from "../services/medical-errors";
import { medicalInstructionService } from "../services/medical-instruction-service";
import type {
  Consultation,
  ConsultationPayload,
  ConsultationStatus,
  ConsultationType,
  MedicalInstruction,
  MedicalInstructionPayload,
  MedicalInstructionPriority,
  MedicalInstructionStatus,
} from "../types";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/features/patients/components/patient-detail.module.css";
import workspace from "@/components/ui/module-workspace.module.css";

const consultationTypes: { value: ConsultationType; label: string }[] = [
  { value: "INITIAL", label: "Initiale" },
  { value: "FOLLOW_UP", label: "Suivi" },
  { value: "PRE_OPERATIVE", label: "Préopératoire" },
  { value: "POST_OPERATIVE", label: "Postopératoire" },
  { value: "OTHER", label: "Autre" },
];

const consultationStatuses: { value: ConsultationStatus; label: string }[] = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "COMPLETED", label: "Terminée" },
  { value: "CANCELLED", label: "Annulée" },
];

const instructionPriorities: { value: MedicalInstructionPriority; label: string }[] = [
  { value: "LOW", label: "Basse" },
  { value: "NORMAL", label: "Normale" },
  { value: "HIGH", label: "Haute" },
  { value: "URGENT", label: "Urgente" },
];

const instructionStatuses: { value: MedicalInstructionStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Terminée" },
  { value: "CANCELLED", label: "Annulée" },
];

const prescriptionLabels: Record<PrescriptionStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

const toneByPrescription: Record<PrescriptionStatus, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "teal",
  CANCELLED: "warning",
  COMPLETED: "success",
};

const toneByConsultation: Record<ConsultationStatus, StatusTone> = {
  DRAFT: "neutral",
  COMPLETED: "success",
  CANCELLED: "warning",
};

function inputDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function isoFromInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDateTime(value: string | null) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ConsultationForm({
  patient,
  consultation,
  onSave,
}: {
  patient: Patient;
  consultation?: Consultation | null;
  onSave: (payload: ConsultationPayload) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className={ui.form}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
          await onSave({
            patient: patient.apiId,
            consultation_date: isoFromInput(String(form.get("consultation_date"))) ?? new Date().toISOString(),
            consultation_type: String(form.get("consultation_type")) as ConsultationType,
            reason: String(form.get("reason") ?? "").trim(),
            patient_complaint: String(form.get("patient_complaint") ?? "").trim(),
            clinical_findings: String(form.get("clinical_findings") ?? "").trim(),
            diagnosis: String(form.get("diagnosis") ?? "").trim(),
            treatment_plan: String(form.get("treatment_plan") ?? "").trim(),
            recommendations: String(form.get("recommendations") ?? "").trim(),
            notes: String(form.get("notes") ?? "").trim(),
            status: String(form.get("status")) as ConsultationStatus,
          });
        } catch (cause) {
          setError(medicalErrorMessage(cause));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className={workspace.twoColumns}>
        <label>Date de consultation<input name="consultation_date" type="datetime-local" required defaultValue={inputDateTime(consultation?.consultation_date)} /></label>
        <label>Type<select name="consultation_type" defaultValue={consultation?.consultation_type ?? "INITIAL"}>{consultationTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      <label>Motif<input name="reason" required maxLength={255} defaultValue={consultation?.reason ?? ""} /></label>
      <label>Plainte du patient<textarea name="patient_complaint" defaultValue={consultation?.patient_complaint ?? ""} /></label>
      <label>Constat clinique<textarea name="clinical_findings" defaultValue={consultation?.clinical_findings ?? ""} /></label>
      <label>Diagnostic<textarea name="diagnosis" defaultValue={consultation?.diagnosis ?? ""} /></label>
      <label>Plan thérapeutique<textarea name="treatment_plan" defaultValue={consultation?.treatment_plan ?? ""} /></label>
      <label>Recommandations<textarea name="recommendations" defaultValue={consultation?.recommendations ?? ""} /></label>
      <label>Notes médecin<textarea name="notes" defaultValue={consultation?.notes ?? ""} /></label>
      <label>Statut<select name="status" defaultValue={consultation?.status ?? "DRAFT"}>{consultationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {error && <p role="alert">{error}</p>}
      <button className={`${ui.action} ${ui.primary}`} type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}

function InstructionForm({
  patient,
  consultations,
  instruction,
  onSave,
}: {
  patient: Patient;
  consultations: Consultation[];
  instruction?: MedicalInstruction | null;
  onSave: (payload: MedicalInstructionPayload) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className={ui.form}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const consultation = String(form.get("consultation") ?? "");
        setBusy(true);
        setError("");
        try {
          await onSave({
            patient: patient.apiId,
            consultation: consultation ? Number(consultation) : null,
            title: String(form.get("title") ?? "").trim(),
            instruction: String(form.get("instruction") ?? "").trim(),
            priority: String(form.get("priority")) as MedicalInstructionPriority,
            status: String(form.get("status")) as MedicalInstructionStatus,
            valid_from: isoFromInput(String(form.get("valid_from") ?? "")),
            valid_until: isoFromInput(String(form.get("valid_until") ?? "")),
          });
        } catch (cause) {
          setError(medicalErrorMessage(cause));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>Titre<input name="title" required maxLength={180} defaultValue={instruction?.title ?? ""} /></label>
      <label>Consultation liée<select name="consultation" defaultValue={instruction?.consultation ?? ""}><option value="">Aucune consultation liée</option>{consultations.map((item) => <option key={item.id} value={item.id}>{formatDateTime(item.consultation_date)} · {item.reason}</option>)}</select></label>
      <label>Instruction<textarea name="instruction" required defaultValue={instruction?.instruction ?? ""} /></label>
      <div className={workspace.twoColumns}>
        <label>Priorité<select name="priority" defaultValue={instruction?.priority ?? "NORMAL"}>{instructionPriorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Statut<select name="status" defaultValue={instruction?.status ?? "ACTIVE"}>{instructionStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      <div className={workspace.twoColumns}>
        <label>Valide depuis<input type="datetime-local" name="valid_from" defaultValue={instruction?.valid_from ? inputDateTime(instruction.valid_from) : ""} /></label>
        <label>Valide jusqu’à<input type="datetime-local" name="valid_until" defaultValue={instruction?.valid_until ? inputDateTime(instruction.valid_until) : ""} /></label>
      </div>
      {error && <p role="alert">{error}</p>}
      <button className={`${ui.action} ${ui.primary}`} type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}

export function PatientPhase9ESections({ patient, mode }: { patient: Patient; mode: "medical" | "prescriptions" }) {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [instructions, setInstructions] = useState<MedicalInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [consultationEditor, setConsultationEditor] = useState<Consultation | "new" | null>(null);
  const [instructionEditor, setInstructionEditor] = useState<MedicalInstruction | "new" | null>(null);
  const [prescriptionEditor, setPrescriptionEditor] = useState(false);
  const canWrite = user?.role === "DOCTOR";
  const canRead = user?.role === "ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE";
  const patientOption = useMemo(() => [patient], [patient]);

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [consultationPage, prescriptionPage, instructionPage] = await Promise.all([
        consultationService.list({ patient: patient.apiId, ordering: "-consultation_date" }),
        prescriptionService.list({ patient: patient.apiId, ordering: "-prescribed_at" }),
        medicalInstructionService.list({ patient: patient.apiId, ordering: "-created_at" }),
      ]);
      setConsultations(consultationPage.results);
      setPrescriptions(prescriptionPage.results);
      setInstructions(instructionPage.results);
    } catch (cause) {
      setError(medicalErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [canRead, patient.apiId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveConsultation(payload: ConsultationPayload) {
    const result = consultationEditor && consultationEditor !== "new"
      ? await consultationService.update(consultationEditor.id, payload)
      : await consultationService.create(payload);
    setConsultations((current) => consultationEditor && consultationEditor !== "new" ? current.map((item) => item.id === result.id ? result : item) : [result, ...current]);
    setConsultationEditor(null);
    setFeedback("Consultation enregistrée.");
  }

  async function saveInstruction(payload: MedicalInstructionPayload) {
    const result = instructionEditor && instructionEditor !== "new"
      ? await medicalInstructionService.update(instructionEditor.id, payload)
      : await medicalInstructionService.create(payload);
    setInstructions((current) => instructionEditor && instructionEditor !== "new" ? current.map((item) => item.id === result.id ? result : item) : [result, ...current]);
    setInstructionEditor(null);
    setFeedback("Instruction médicale enregistrée.");
  }

  async function savePrescription(payload: PrescriptionPayload) {
    const result = await prescriptionService.create(payload);
    setPrescriptions((current) => [result, ...current]);
    setPrescriptionEditor(false);
    setFeedback("Ordonnance enregistrée.");
  }

  if (!canRead) return <section className={ui.panel}><h2>Dossier médical</h2><p>Informations cliniques non disponibles pour votre rôle.</p></section>;
  if (loading) return <section className={ui.panel}><p role="status">Chargement des données médicales…</p></section>;
  if (error) return <section className={ui.panel}><h2>Dossier médical</h2><p role="alert">{error}</p><button className={ui.action} onClick={() => void load()}>Réessayer</button></section>;

  if (mode === "prescriptions") {
    return (
      <section className={ui.panel}>
        <div className={ui.actions}><h2>Ordonnances</h2>{canWrite && <button className={`${ui.action} ${ui.primary}`} onClick={() => setPrescriptionEditor(true)}>Nouvelle ordonnance</button>}</div>
        {feedback && <p role="status">{feedback}</p>}
        {prescriptions.length ? <ol className={styles.timeline}>{prescriptions.map((item) => <li key={item.id}><strong>{formatDateTime(item.prescribed_at)} · {item.items.length} médicament(s)</strong><StatusBadge tone={toneByPrescription[item.status]}>{prescriptionLabels[item.status]}</StatusBadge><p>{item.items[0]?.medication_name ?? item.general_instructions}</p><PrescriptionActions id={item.id} /></li>)}</ol> : <p>Aucune ordonnance enregistrée pour ce patient.</p>}
        <DetailDialog title="Nouvelle ordonnance" open={prescriptionEditor} onClose={() => setPrescriptionEditor(false)}>
          {prescriptionEditor && <PrescriptionEditor patients={patientOption} consultations={consultations} defaultPatientId={patient.apiId} lockedPatient onSave={savePrescription} />}
        </DetailDialog>
      </section>
    );
  }

  return (
    <>
      <section className={ui.panel}>
        <div className={ui.actions}><h2>Consultations</h2>{canWrite && <button className={`${ui.action} ${ui.primary}`} onClick={() => { setFeedback(""); setConsultationEditor("new"); }}>Nouvelle consultation</button>}</div>
        {feedback && <p role="status">{feedback}</p>}
        {consultations.length ? <ol className={styles.timeline}>{consultations.map((item) => <li key={item.id}><strong>{formatDateTime(item.consultation_date)} · {item.reason}</strong><StatusBadge tone={toneByConsultation[item.status]}>{consultationStatuses.find((status) => status.value === item.status)?.label ?? item.status}</StatusBadge><p>{item.diagnosis || item.clinical_findings || "Aucun diagnostic renseigné."}</p>{canWrite && <button className={ui.action} onClick={() => setConsultationEditor(item)}>Modifier</button>}{canWrite && <CreateWorkLeaveButton patient={patient} consultation={item.id} />}</li>)}</ol> : <p>Aucune consultation enregistrée pour ce patient.</p>}
      </section>
      <section className={ui.panel}>
        <div className={ui.actions}><h2>Instructions médicales</h2>{canWrite && <button className={`${ui.action} ${ui.primary}`} onClick={() => { setFeedback(""); setInstructionEditor("new"); }}>Nouvelle instruction</button>}</div>
        {instructions.length ? <ol className={styles.timeline}>{instructions.map((item) => <li key={item.id}><strong>{item.title}</strong><StatusBadge tone={item.priority === "URGENT" || item.priority === "HIGH" ? "warning" : "neutral"}>{instructionPriorities.find((priority) => priority.value === item.priority)?.label ?? item.priority}</StatusBadge><p>{item.instruction}</p><time>{formatDateTime(item.valid_from)} → {formatDateTime(item.valid_until)}</time>{canWrite && <button className={ui.action} onClick={() => setInstructionEditor(item)}>Modifier</button>}</li>)}</ol> : <p>Aucune instruction médicale enregistrée pour ce patient.</p>}
      </section>
      <DetailDialog title={consultationEditor === "new" ? "Nouvelle consultation" : "Modifier consultation"} open={Boolean(consultationEditor)} onClose={() => setConsultationEditor(null)}>
        {consultationEditor && <ConsultationForm patient={patient} consultation={consultationEditor === "new" ? null : consultationEditor} onSave={saveConsultation} />}
      </DetailDialog>
      <DetailDialog title={instructionEditor === "new" ? "Nouvelle instruction" : "Modifier instruction"} open={Boolean(instructionEditor)} onClose={() => setInstructionEditor(null)}>
        {instructionEditor && <InstructionForm patient={patient} consultations={consultations} instruction={instructionEditor === "new" ? null : instructionEditor} onSave={saveInstruction} />}
      </DetailDialog>
    </>
  );
}
