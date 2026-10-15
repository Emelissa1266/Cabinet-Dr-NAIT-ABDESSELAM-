"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/components/auth-provider";
import { listConsultations } from "@/features/medical/services/consultation-service";
import { ApiError } from "@/lib/api-client";
import type { Consultation } from "@/features/medical/types";
import type { Patient } from "@/features/patients/types";
import type { LeavePayload, WorkLeave } from "../types";
import { allLeaves } from "../services/work-leave-api";
import { durationDays, followingDay, todayDate, leaveError } from "../services/work-leave-form";
import styles from "./work-leaves.module.css";
import ui from "@/components/ui/clinical.module.css";

export function WorkLeaveEditor({patients, patient, consultation, leave, previous, onSave}: {patients: Patient[]; patient?: Patient; consultation?: number; leave?: WorkLeave; previous?: WorkLeave; onSave: (payload: LeavePayload) => Promise<void>}) {
  const {user} = useAuth();
  const [patientId, setPatientId] = useState(patient?.apiId ?? previous?.patient ?? leave?.patient ?? patients[0]?.apiId ?? 0);
  const [kind, setKind] = useState<"INITIAL" | "EXTENSION">(previous ? "EXTENSION" : leave?.leave_type ?? "INITIAL");
  const [previousId, setPreviousId] = useState(previous?.id ?? leave?.previous_leave ?? 0);
  const [consultationId, setConsultationId] = useState(consultation ?? leave?.consultation ?? 0);
  const [start, setStart] = useState(previous ? followingDay(previous.end_date) : leave?.start_date ?? todayDate());
  const [end, setEnd] = useState(previous ? followingDay(previous.end_date) : leave?.end_date ?? todayDate());
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [predecessors, setPredecessors] = useState<WorkLeave[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const selectedPatient = patients.find(p => p.apiId === patientId) ?? patient;
  const previousLeave = predecessors.find(p => p.id === previousId) ?? previous;
  useEffect(() => {
    let active = true;
    async function load() {
      const results: Consultation[] = []; let page = 1; let response;
      do {response = await listConsultations({patient: patientId, doctor: user?.id, page: page++}); results.push(...response.results);} while(response.next);
      const previous = await allLeaves({patient: patientId, status: "ISSUED"});
      if (active) {setConsultations(results); setPredecessors(previous);}
    }
    if (patientId && user?.role === "DOCTOR") void load().catch(cause => {if(active) setError(cause instanceof Error ? cause.message : "Chargement impossible.");});
    return () => {active = false;};
  }, [patientId, user?.id, user?.role]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setFields({});
    if (!patientId || !durationDays(start, end)) {setError("Sélectionnez un patient et une période valide."); return;}
    if (kind === "EXTENSION" && (!previousLeave || start <= previousLeave.end_date)) {setError("La prolongation doit suivre la fin de l'arrêt précédent."); return;}
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {await onSave({patient: patientId, consultation: consultationId || null, leave_type: kind, previous_leave: kind === "EXTENSION" ? previousId || null : null, issued_date: String(form.get("issued_date")), start_date: start, end_date: end, medical_reason: String(form.get("medical_reason") ?? ""), internal_notes: String(form.get("internal_notes") ?? ""), patient_instructions: String(form.get("patient_instructions") ?? "")});}
    catch(cause) {
      setError(leaveError(cause));
      if(cause instanceof ApiError && cause.data && typeof cause.data === "object") setFields(Object.fromEntries(Object.entries(cause.data).map(([key,value]) => [key, Array.isArray(value) ? value.join(" ") : String(value)])));
    } finally {setBusy(false);}
  }
  return <form className={ui.form} onSubmit={submit}>
    <fieldset className={styles.group} disabled={busy}>
      <legend>Patient et consultation</legend>
      <label>Patient<select required value={patientId || ""} disabled={Boolean(patient || previous)} onChange={event => {setPatientId(Number(event.target.value));setConsultationId(0);setPreviousId(0);}}><option value="">Sélectionner un patient</option>{patients.map(p => <option value={p.apiId} key={p.apiId}>{p.name}</option>)}</select></label>
      {selectedPatient && <p>{selectedPatient.name}{selectedPatient.dateOfBirth ? ` · Né(e) le ${selectedPatient.dateOfBirth}` : ""}</p>}
      <label>Consultation associée (facultative)<select value={consultationId} disabled={Boolean(consultation)} onChange={event => setConsultationId(Number(event.target.value))}><option value={0}>Aucune</option>{consultations.map(c => <option value={c.id} key={c.id}>{c.consultation_date.slice(0,10)} · {c.reason}</option>)}</select></label>
      <label>Type<select value={kind} onChange={event => setKind(event.target.value as "INITIAL" | "EXTENSION")}><option value="INITIAL">Arrêt initial</option><option value="EXTENSION">Prolongation</option></select></label>
      {kind === "EXTENSION" && <label>Arrêt précédent<select required value={previousId || ""} onChange={event => {const id = Number(event.target.value);setPreviousId(id);const prev = predecessors.find(p => p.id === id);if(prev) {setStart(followingDay(prev.end_date));setEnd(followingDay(prev.end_date));}}}><option value="">Sélectionner un arrêt émis</option>{predecessors.map(p => <option key={p.id} value={p.id}>{p.certificate_number} · {p.start_date} → {p.end_date}</option>)}</select></label>}
      {kind === "EXTENSION" && previousLeave && <p>{previousLeave.certificate_number} : {previousLeave.start_date} → {previousLeave.end_date}</p>}
    </fieldset>
    <fieldset className={styles.group} disabled={busy}><legend>Période</legend>
      <label>Date de prescription<input required type="date" name="issued_date" defaultValue={leave?.issued_date ?? todayDate()}/></label>
      <label>Début<input required type="date" value={start} onChange={event => setStart(event.target.value)}/></label>
      <label>Fin<input required type="date" min={start} value={end} onChange={event => setEnd(event.target.value)}/></label>
      <p role="status">Durée : {durationDays(start,end)} jour(s) calendaires, début et fin inclus.</p>
    </fieldset>
    <label>Motif médical confidentiel<textarea name="medical_reason" defaultValue={leave?.medical_reason}/></label>
    <label>Observations internes confidentielles<textarea name="internal_notes" defaultValue={leave?.internal_notes}/></label>
    <label>Instructions destinées au patient<textarea name="patient_instructions" defaultValue={leave?.patient_instructions}/></label>
    <p className={ui.muted}>Le PDF destiné à l’employeur ne contient ni motif médical, ni observations internes, ni instructions libres. L’enregistrement crée un brouillon ; l’émission nécessite votre validation.</p>
    {error && <p role="alert">{error}</p>}{Object.entries(fields).map(([key,value]) => <p role="alert" key={key}>{({patient:"Patient",consultation:"Consultation",previous_leave:"Arrêt précédent",start_date:"Début",end_date:"Fin",issued_date:"Prescription",leave_type:"Type"} as Record<string,string>)[key] ?? "Validation"} : {value}</p>)}
    <button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
  </form>;
}
