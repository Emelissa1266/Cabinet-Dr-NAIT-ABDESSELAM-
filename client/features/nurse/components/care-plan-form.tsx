"use client";
import {useState} from "react";
import {useNurse} from "./nurse-provider";
import {useClinic} from "@/features/clinic/components/clinic-provider";
import {careTotal} from "../services/care-model";
import {formatAmount} from "@/lib/clinical-format";
import type {NursingProgram} from "../types";
import ui from "@/components/ui/clinical.module.css";
export function CarePlanForm({program,onSave}:{program?:NursingProgram;onSave:(id:string)=>void}){
 const {data,execute}=useNurse();const {admin}=useClinic();const types=data.careTypes?.filter(t=>t.active)??[];
 const [typeId,setType]=useState(program?.careTypeId??types[0]?.id??"");const type=types.find(t=>t.id===typeId);
 const [count,setCount]=useState(program?.plannedSessions??type?.defaultSessions??1);const [price,setPrice]=useState(program?.pricePerSession??type?.defaultPricePerSession??0);const [error,setError]=useState("");
 return <form className={ui.form} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const id=program?.id??"CARE-"+crypto.randomUUID();const doctorId=String(f.get("doctor"));execute({type:"care",care:{id,patientId:program?.patientId??String(f.get("patient")),careTypeId:typeId,doctorId,doctor:admin.doctors.find(d=>d.id===doctorId)!.name,plannedSessions:count,pricePerSession:price,zone:String(f.get("zone")),date:"",start:"",room:""}});onSave(id);}catch(err){setError(err instanceof Error?err.message:"Échec de l’enregistrement.");}}}>
 <label>Patient<select name="patient" required disabled={Boolean(program)} defaultValue={program?.patientId}>{data.patients.map(p=><option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}</select></label>
 <label>Type de soin<select value={typeId} disabled={Boolean(program)} onChange={e=>{const t=types.find(t=>t.id===e.target.value)!;setType(t.id);setCount(t.defaultSessions);setPrice(t.defaultPricePerSession);}}>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <p>Catégorie : {data.categories?.find(c=>c.id===type?.categoryId)?.name}</p><label>Médecin assigné<select name="doctor" defaultValue={program?.doctorId??"DR-2"}>{admin.doctors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><p>Infirmière : {data.nurse.name}</p>
 <label>Zone anatomique<input name="zone" required defaultValue={program?.zone}/></label><label>Séances prévues<input type="number" min={1} max={60} required value={count} onInput={e=>setCount(Number(e.currentTarget.value))} onChange={e=>setCount(Number(e.target.value))}/></label><label>Prix par séance (DA)<input type="number" min={0} step="0.01" required value={price} onInput={e=>setPrice(Number(e.currentTarget.value))} onChange={e=>setPrice(Number(e.target.value))}/></label><strong>Total estimé : {formatAmount(careTotal(price,count))}</strong>
 <label>Protocole médical — lecture seule<textarea readOnly value={program?.protocol??type?.protocol??""}/></label><p>Les séances sont ensuite planifiées individuellement dans leur historique.</p>{error&&<p role="alert">{error}</p>}<button type="submit">Enregistrer le programme</button></form>;
}
