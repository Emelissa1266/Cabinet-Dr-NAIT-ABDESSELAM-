"use client";
import { useState } from "react";
import type { Patient } from "@/features/patients/types";
import { formatAmount } from "@/lib/clinical-format";
import { completedSessions, type CareCategory, type CareTreatment, type TreatmentDraft, type TreatmentStatus, type CareNurse, type CareProtocol } from "../types";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";
export function TreatmentForm({ patients, categories, nurses, protocols, planningDate, treatment, onSave }: { patients: Patient[]; categories: CareCategory[]; nurses: CareNurse[]; protocols: CareProtocol[]; planningDate: string; treatment?: CareTreatment; onSave: (draft: TreatmentDraft) => Promise<void> }) {
 const [typeName, setTypeName] = useState(treatment?.type ?? "");
 const [categoryId, setCategoryId] = useState(treatment?.categoryId ?? "");
 const [instructions, setInstructions] = useState(treatment?.planning?.instructions ?? "");
 const [duration, setDuration] = useState(treatment?.planning?.durationMinutes ?? 30);
 const [planned, setPlanned] = useState(treatment?.plannedSessions ?? 6);
 const [price, setPrice] = useState(treatment?.pricePerSession ?? 0);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState("");
 const completed = treatment ? completedSessions(treatment) : 0;
 return <form className={ui.form} onSubmit={async event => {
 event.preventDefault(); const form = new FormData(event.currentTarget);
 const type = String(form.get("type") ?? "").trim();
 const status = String(form.get("status")) as TreatmentStatus;
 if (!type || !Number.isInteger(planned) || planned < Math.max(1,completed) || !Number.isFinite(price) || price < 0) { setError("Vérifiez le type, le nombre de séances et le tarif."); return; }
 if (status === "Terminé" && planned !== completed) { setError("Un programme ne peut être terminé tant que toutes les séances ne sont pas réalisées."); return; }
 setBusy(true);setError("");
 try { await onSave({ patientId:String(form.get("patient")),categoryId:String(form.get("category")),type,plannedSessions:planned,pricePerSession:price,status,startDate:String(form.get("startDate")),notes:String(form.get("notes")).trim(), planning: { ...treatment?.planning, date: String(form.get("date")), time: String(form.get("time")), room: String(form.get("room")).trim(), nurseId: String(form.get("nurse")), doctor: treatment?.planning?.doctor ?? "Dr. Gaya", durationMinutes: duration, instructions: instructions.trim(), parameters: treatment?.planning?.parameters ?? [], zone: String(form.get("zone")).trim(), observations: treatment?.planning?.observations ?? "" } }); } catch {setError("Le programme n’a pas pu être enregistré. Réessayez.");} finally {setBusy(false);}
 }}>
 <p className={styles.notice}>Aucune consultation préalable requise. Les séances seront réalisées et validées par le personnel infirmier.</p>
 <label>Patient<select name="patient" defaultValue={treatment?.patientId ?? ""} required><option value="" disabled>Sélectionner un patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Protocole du catalogue<select defaultValue="" onChange={event => { const protocol = protocols.find(p => p.id === event.target.value); if (protocol) { setTypeName(protocol.name); setCategoryId(protocol.categoryId); setInstructions(protocol.instructions); setDuration(protocol.durationMinutes); } }}><option value="">Saisie personnalisée</option>{protocols.filter(p => p.active && categories.some(c => c.id === p.categoryId && c.active)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Catégorie<select name="category" value={categoryId} onChange={event => setCategoryId(event.target.value)} required><option value="" disabled>Sélectionner une catégorie</option>{categories.filter(c=>c.active||c.id===treatment?.categoryId).map(c=><option key={c.id} value={c.id}>{c.name}{!c.active?" (inactive)":""}</option>)}</select></label>
 <label>Type de traitement<input name="type" value={typeName} onChange={event => setTypeName(event.target.value)} required maxLength={120}/></label>
 <div className={styles.twoColumns}><label>Date du soin<input name="date" type="date" defaultValue={treatment?.planning?.date ?? planningDate} required/></label><label>Heure du soin<input name="time" type="time" defaultValue={treatment?.planning?.time ?? "09:00"} required/></label></div>
 <label>Infirmier(ère) assigné(e)<select name="nurse" defaultValue={treatment?.planning?.nurseId ?? ""}><option value="">Non assigné</option>{nurses.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
 <div className={styles.twoColumns}><label>Salle<input name="room" maxLength={80} defaultValue={treatment?.planning?.room}/></label><label>Durée prévue (min)<input type="number" min={5} max={480} value={Number.isNaN(duration) ? "" : duration} onChange={event => setDuration(event.target.valueAsNumber)} required/></label></div>
 <label>Zone traitée<input name="zone" maxLength={120} defaultValue={treatment?.planning?.zone}/></label>
 <label>Instructions du médecin<textarea value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={2000}/></label>
 <div className={styles.twoColumns}><label>Séances prévues<input type="number" min={Math.max(1,completed)} max={100} step={1} value={Number.isNaN(planned) ? "" : planned} onChange={e=>setPlanned(e.target.valueAsNumber)} required/></label><label>Tarif par séance (DA)<input type="number" min={0} max={10000000} step="0.01" value={Number.isNaN(price) ? "" : price} onChange={e=>setPrice(e.target.valueAsNumber)} required/></label></div>
 <p>Total prévu : <strong>{formatAmount((planned||0)*(price||0))}</strong></p>
 <label>Date de début<input name="startDate" type="date" defaultValue={treatment?.startDate} required/></label>
 <label>Statut<select name="status" defaultValue={treatment?.status ?? "Planifié"}>{(["Planifié","En cours","Suspendu","Terminé"] as const).map(s=><option key={s}>{s}</option>)}</select></label>
 <label>Notes<textarea name="notes" defaultValue={treatment?.notes} maxLength={2000}/></label>
 {error&&<p role="alert">{error}</p>}
 <p className={styles.notice}>Enregistrement de démonstration, conservé jusqu’au rechargement de la page.</p>
 <button className={`${ui.action} ${ui.primary}`} disabled={busy} type="submit">{busy?"Enregistrement…":"Enregistrer le programme"}</button>
 </form>;
}
