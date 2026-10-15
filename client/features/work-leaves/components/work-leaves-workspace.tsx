"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/components/auth-provider";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { listPatients } from "@/features/patients/services/patient-service";
import type { Patient } from "@/features/patients/types";
import { filenameFromDisposition } from "@/features/billing/services/billing-api-service";
import { openPrivatePdf } from "@/lib/private-pdf";
import type { LeaveStatus, WorkLeave } from "../types";
import { cancelLeave, createLeave, deleteLeave, issueLeave, leavePdf, listLeaves, updateLeave } from "../services/work-leave-api";
import { leaveActions, leaveLabels, leaveError } from "../services/work-leave-form";
import { WorkLeaveEditor } from "./work-leave-editor";
import styles from "./work-leaves.module.css";
import ui from "@/components/ui/clinical.module.css";

const eventLabels: Record<string,string> = {WORK_LEAVE_CREATED: "Brouillon créé", WORK_LEAVE_UPDATED: "Brouillon modifié", WORK_LEAVE_ISSUED: "Certificat émis", WORK_LEAVE_CANCELLED: "Certificat annulé", WORK_LEAVE_PDF_VIEWED: "Aperçu consulté", WORK_LEAVE_PDF_DOWNLOADED: "PDF téléchargé"};
export function WorkLeavesWorkspace({patient, consultationFilter, patientIdFilter}: {patient?: Patient; consultationFilter?: number; patientIdFilter?: number}) {
  const {user} = useAuth();
  const [patients,setPatients] = useState<Patient[]>(patient ? [patient] : []);
  const [items,setItems] = useState<WorkLeave[]>([]);
  const [count,setCount] = useState(0);
  const [hasNext,setHasNext] = useState(false);
  const [page,setPage] = useState(1);
  const [patientFilter,setPatientFilter] = useState(patientIdFilter ?? 0);
  const generation=useRef(0);
  const [search,setSearch] = useState("");
  const [status,setStatus] = useState<LeaveStatus | "">("");
  const [selected,setSelected] = useState<WorkLeave | null>(null);
  const [editor,setEditor] = useState<{leave?: WorkLeave; previous?: WorkLeave} | null>(null);
  const [confirmation,setConfirmation] = useState<"issue" | "cancel" | "delete" | null>(null);
  const [reason,setReason] = useState("");
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const load = useCallback(async () => {
    if(user?.role !== "DOCTOR") return;
    const current=++generation.current;
    try {const response = await listLeaves({patient: patient?.apiId ?? (patientFilter || undefined), consultation: consultationFilter, page, search, status});if(current !== generation.current) return;setItems(response.results);setSelected(current=>current ? response.results.find(item=>item.id===current.id) ?? current : null);setCount(response.count);setHasNext(Boolean(response.next));setError("");}
    catch(cause) {if(current===generation.current)setError(cause instanceof Error ? cause.message : "Chargement impossible.");}
    finally {if(current===generation.current)setLoading(false);}
  },[user?.role,patient,patientFilter,consultationFilter,page,search,status]);
  useEffect(() => {const timer = window.setTimeout(() => void load(),0); const refresh = () => void load(); window.addEventListener("work-leaves-changed",refresh); return () => {window.clearTimeout(timer);window.removeEventListener("work-leaves-changed",refresh);};},[load]);
  useEffect(() => {
    if(patient || user?.role !== "DOCTOR") return;
    let active = true;
    async function loadPatients() {const results: Patient[]=[];let page=1;let response;do {response=await listPatients({page:page++});results.push(...response.results);}while(response.next);if(active)setPatients(results);}
    void loadPatients().catch(cause => {if(active)setError(cause instanceof Error ? cause.message : "Patients indisponibles.");});
    return () => {active=false;};
  },[patient,user?.role]);
  async function run(action: () => Promise<WorkLeave | void>, success: string) {
    setBusy(true);setError("");setMessage("");
    try {const result=await action();if(result)setSelected(result);setMessage(success);setConfirmation(null);await load();}
    catch(cause) {setError(leaveError(cause));}
    finally {setBusy(false);}
  }
  async function download(item: WorkLeave) {
    const response=await leavePdf(item.id);const url=URL.createObjectURL(response.blob);const link=document.createElement("a");link.href=url;link.download=filenameFromDisposition(response.headers.get("content-disposition"),`Arret_Travail_${item.certificate_number}.pdf`);document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const pdfActions = (item: WorkLeave) => <div className={ui.actions}>
    <button className={ui.action} disabled={busy} onClick={()=>void run(async()=>{await openPrivatePdf(()=>leavePdf(item.id,true));},"Aperçu ouvert.")}>Voir</button>
    <button className={ui.action} disabled={busy} onClick={()=>void run(()=>download(item),"PDF téléchargé.")}>Télécharger PDF</button>
    <button className={ui.action} disabled={busy || !leaveActions(item.status).print} title={item.status !== "ISSUED" ? "L'impression d'un certificat valide nécessite son émission." : undefined} onClick={()=>void run(async()=>{await openPrivatePdf(()=>leavePdf(item.id,true),true);},"Aperçu d'impression ouvert.")}>Imprimer</button>
  </div>;
  if(user?.role !== "DOCTOR") return null;
  return <section className={ui.panel}>
    <header className={ui.heading}><div>{patient ? <h2>Arrêts de travail</h2> : <h1 className={ui.title}>Arrêts de travail</h1>}<p className={ui.description}>Certificats, prolongations et historique.</p></div><button className={`${ui.action} ${ui.primary}`} disabled={!patients.length || busy} onClick={()=>setEditor({})}>+ Nouvel arrêt de travail</button></header>
    <div className={ui.toolbar}>{!patient && <label>Patient<select value={patientFilter} disabled={Boolean(consultationFilter)} onChange={e=>{setPatientFilter(Number(e.target.value));setSelected(null);setPage(1);}}><option value={0}>Tous les patients</option>{patients.map(p=><option key={p.apiId} value={p.apiId}>{p.name}</option>)}</select></label>}<label>Rechercher<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Référence ou patient"/></label><label>Statut<select value={status} onChange={e=>{setStatus(e.target.value as LeaveStatus | "");setPage(1);}}><option value="">Tous</option>{Object.entries(leaveLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><button className={ui.action} disabled={busy} onClick={()=>void load()}>Actualiser</button></div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {loading ? <p role="status">Chargement des arrêts…</p> : <div className={ui.tableScroll}><table className={ui.table}><thead><tr>{["Référence","Patient","Début","Fin","Durée","Statut","Actions"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{items.map(item=><tr key={item.id}><td><button className={ui.action} onClick={()=>setSelected(item)}>{item.certificate_number}</button></td><td>{item.patient_name}</td><td>{item.start_date}</td><td>{item.end_date}</td><td>{item.duration_days} jours</td><td><StatusBadge tone={item.status === "ISSUED" ? "teal" : item.status === "CANCELLED" ? "warning" : "neutral"}>{leaveLabels[item.status]}</StatusBadge></td><td>{pdfActions(item)}</td></tr>)}</tbody></table>{!items.length && <p>Aucun arrêt enregistré.</p>}</div>}
    <footer className={ui.footer}><span>{count} arrêt(s)</span><div className={ui.actions}><button className={ui.action} disabled={page===1} onClick={()=>setPage(page-1)}>Précédent</button><span>Page {page}</span><button className={ui.action} disabled={!hasNext} onClick={()=>setPage(page+1)}>Suivant</button></div></footer>
    <DetailDialog title="Détail de l'arrêt de travail" open={Boolean(selected)} onClose={()=>{setSelected(null);setConfirmation(null);}}>{selected && <>
      <h3>{selected.certificate_number} · {leaveLabels[selected.status]}</h3><p>{selected.patient_name}{selected.patient_birth_date ? ` · ${selected.patient_birth_date}` : ""}</p><p>{selected.start_date} → {selected.end_date} · {selected.duration_days} jours calendaires</p><p>Médecin : {selected.doctor_name} · Prescription : {selected.issued_date}</p>
      {selected.previous_leave && <p>Prolongation de {selected.previous_reference} ({selected.previous_start_date} → {selected.previous_end_date})</p>}
      {selected.consultation && <p>Consultation associée #{selected.consultation}</p>}
      {selected.medical_reason && <p><strong>Motif médical confidentiel : </strong>{selected.medical_reason}</p>}{selected.internal_notes && <p><strong>Observations internes : </strong>{selected.internal_notes}</p>}{selected.patient_instructions && <p><strong>Instructions au patient : </strong>{selected.patient_instructions}</p>}
      {selected.status === "CANCELLED" && <p role="status">ANNULÉ le {selected.cancelled_at} : {selected.cancellation_reason}</p>}
      {pdfActions(selected)}<div className={ui.actions}>
      {leaveActions(selected.status).edit && <button className={ui.action} onClick={()=>setEditor({leave:selected})}>Modifier le brouillon</button>}
      {leaveActions(selected.status).issue && <button className={`${ui.action} ${ui.primary}`} onClick={()=>setConfirmation("issue")}>Valider et émettre</button>}
      {leaveActions(selected.status).remove && <button className={ui.action} onClick={()=>setConfirmation("delete")}>Supprimer le brouillon</button>}
      {leaveActions(selected.status).cancel && <button className={ui.action} onClick={()=>{setReason("");setConfirmation("cancel");}}>Annuler le certificat</button>}
      {leaveActions(selected.status).extend && <button className={ui.action} onClick={()=>setEditor({previous:selected})}>Créer une prolongation</button>}
      </div><h3>Historique</h3><ol>{selected.history.map((event,index)=><li key={index}>{event.created_at} · {eventLabels[event.action] ?? "Opération enregistrée"}</li>)}</ol>
    </>}</DetailDialog>
    <DetailDialog wide title={editor?.leave ? "Modifier le brouillon" : "Nouvel arrêt de travail"} open={Boolean(editor)} onClose={()=>setEditor(null)}>{editor && <WorkLeaveEditor patients={patients} patient={patient ?? (!editor.leave && !editor.previous ? patients.find(p=>p.apiId===patientFilter) : undefined)} consultation={consultationFilter} leave={editor.leave} previous={editor.previous} onSave={async payload=>{const saved=editor.leave ? await updateLeave(editor.leave.id,payload) : await createLeave(payload);setSelected(saved);setEditor(null);setMessage("Brouillon enregistré.");await load();}}/>}</DetailDialog>
    <DetailDialog title={confirmation === "issue" ? "Valider et émettre" : confirmation === "cancel" ? "Annuler le certificat" : "Supprimer le brouillon"} open={Boolean(confirmation)} onClose={()=>{if(!busy)setConfirmation(null);}}>{selected && <form className={ui.form} onSubmit={e=>{e.preventDefault();void run(async()=>{if(confirmation === "issue") return issueLeave(selected.id);if(confirmation === "cancel") return cancelLeave(selected.id,reason);await deleteLeave(selected.id);setSelected(null);},confirmation === "issue" ? "Certificat émis." : confirmation === "cancel" ? "Certificat annulé, historique conservé." : "Brouillon supprimé.");}}>
      <p>{selected.certificate_number} · {selected.patient_name} · {selected.start_date} → {selected.end_date} · {selected.duration_days} jours</p>
      {confirmation === "issue" && <><p>Après émission, les informations ne pourront plus être modifiées. Une correction nécessitera une annulation et un nouveau document.</p><label className={styles.check}><input type="checkbox" required/>Je valide les informations et la délivrance de ce certificat.</label></>}
      {confirmation === "cancel" && <label>Motif d’annulation obligatoire<textarea required value={reason} onChange={e=>setReason(e.target.value)} maxLength={5000}/></label>}
      {confirmation === "delete" && <p>Voulez-vous supprimer ce brouillon ? Cette action est irréversible.</p>}
      {error && <p role="alert">{error}</p>}<button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "En cours…" : "Confirmer"}</button>
    </form>}</DetailDialog>
  </section>;
}
