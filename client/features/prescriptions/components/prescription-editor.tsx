"use client";
import { useState } from "react";
import type { Patient } from "@/features/patients/types";
import type { PrescriptionDraft, PrescriptionMedication } from "../types";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";
const newMedication = (id:string):PrescriptionMedication=>({id,name:"",dosage:"",frequency:"",duration:"",instructions:""});
export function PrescriptionEditor({ patients,onSave }: { patients:Patient[];onSave:(draft:PrescriptionDraft)=>Promise<void> }) {
 const [medications,setMedications]=useState<PrescriptionMedication[]>([newMedication("first")]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 function update(id:string,key:Exclude<keyof PrescriptionMedication,"id">,value:string){setMedications(current=>current.map(m=>m.id===id?{...m,[key]:value}:m));}
 return <form className={ui.form} onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);if(!medications.length||medications.some(m=>![m.name,m.dosage,m.frequency,m.duration].every(value=>value.trim()))){setError("Renseignez le médicament, la posologie, la fréquence et la durée.");return;}setBusy(true);setError("");try{await onSave({patientId:String(form.get("patient")),date:String(form.get("date")),medications:medications.map(m=>({...m,name:m.name.trim(),dosage:m.dosage.trim(),frequency:m.frequency.trim(),duration:m.duration.trim(),instructions:m.instructions.trim()})),notes:String(form.get("notes")).trim()});}catch{setError("Impossible d’enregistrer l’ordonnance. Réessayez.");}finally{setBusy(false);}}}>
 <label>Patient<select name="patient" required defaultValue=""><option value="" disabled>Sélectionner un patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Date de prescription<input type="date" name="date" required defaultValue={new Date().toLocaleDateString("en-CA")}/></label>
 {medications.map((m,index)=><fieldset className={styles.fieldset} key={m.id}><legend>Médicament {index+1}</legend><label>Médicament<input required maxLength={120} value={m.name} onChange={e=>update(m.id,"name",e.target.value)}/></label><label>Posologie<input required maxLength={120} value={m.dosage} onChange={e=>update(m.id,"dosage",e.target.value)} placeholder="Dose et voie d’administration"/></label><div className={styles.twoColumns}><label>Fréquence<input required maxLength={100} value={m.frequency} onChange={e=>update(m.id,"frequency",e.target.value)}/></label><label>Durée<input required maxLength={100} value={m.duration} onChange={e=>update(m.id,"duration",e.target.value)}/></label></div><label>Instructions<input maxLength={500} value={m.instructions} onChange={e=>update(m.id,"instructions",e.target.value)}/></label><button className={ui.action} type="button" disabled={medications.length===1} onClick={()=>setMedications(current=>current.filter(item=>item.id!==m.id))} aria-label={`Retirer le médicament ${index+1}`}>Retirer</button></fieldset>)}
 <button className={ui.action} type="button" disabled={medications.length>=20} onClick={()=>setMedications(current=>[...current,newMedication(crypto.randomUUID())])}>Ajouter un médicament</button>
 <label>Instructions générales<textarea name="notes" maxLength={2000}/></label><p className={styles.notice}>Brouillon de démonstration conservé jusqu’au rechargement. Aucune ordonnance réelle n’est délivrée.</p>
 {error&&<p role="alert">{error}</p>}<button className={`${ui.action} ${ui.primary}`} type="submit" disabled={busy}>{busy?"Enregistrement…":"Enregistrer le brouillon"}</button>
 </form>;
}
