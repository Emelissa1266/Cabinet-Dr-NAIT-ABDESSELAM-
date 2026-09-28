"use client";
import {useState} from "react";
import {useNurse} from "./nurse-provider";
import {DetailDialog} from "@/components/ui/detail-dialog";
import {CarePlanForm} from "./care-plan-form";
import {programProgress} from "../services/session-state";
import {formatAmount,formatDate} from "@/lib/clinical-format";
import type {NursingProgram,NursingSession} from "../types";
import styles from "./nurse.module.css";
import ui from "@/components/ui/clinical.module.css";
export function SessionTracking({program}:{program:NursingProgram}){
 const {data,execute}=useNurse();const progress=programProgress(data,program);const [schedule,setSchedule]=useState<NursingSession|null>(null);const [edit,setEdit]=useState(false);const [error,setError]=useState("");
 return <section className={styles.inset}><h3>Suivi des séances</h3><p>{progress.completed} terminées · {progress.current} en cours · {progress.remaining} à réaliser hors séance en cours</p><p>{progress.remainingToComplete} non terminées sur {progress.total} prévues</p><button className={styles.secondary} onClick={()=>setEdit(true)}>Modifier le programme et le tarif</button><div style={{overflowX:"auto"}}><table className={ui.table}><thead><tr><th>Séance</th><th>Date / statut</th><th>Prix</th><th>Action</th></tr></thead><tbody>{data.sessions.filter(s=>s.programId===program.id).sort((a,b)=>(a.sessionNumber??0)-(b.sessionNumber??0)).map(s=><tr key={s.id}><td>{s.sessionNumber} / {program.plannedSessions}</td><td>{s.date?formatDate(s.date)+" · "+s.start:"Date à définir"}<br/>{s.status}</td><td>{formatAmount(program.pricePerSession??0)}</td><td>{["À planifier","Planifié"].includes(s.status)&&<button className={styles.secondary} onClick={()=>{setError("");setSchedule(s);}}>{s.date?"Replanifier":"Planifier"}</button>}</td></tr>)}</tbody></table></div>
 <DetailDialog title="Programme de soins" open={edit} onClose={()=>setEdit(false)}>{edit&&<CarePlanForm program={program} onSave={()=>setEdit(false)}/>}</DetailDialog>
 <DetailDialog title="Planifier la séance" open={Boolean(schedule)} onClose={()=>setSchedule(null)}>{schedule&&<form className={ui.form} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{execute({type:"schedule",id:schedule.id,date:String(f.get("date")),start:String(f.get("start")),duration:Number(f.get("duration")),room:String(f.get("room"))});setSchedule(null);}catch(err){setError(err instanceof Error?err.message:"Créneau invalide.");}}}><label>Date<input name="date" type="date" required defaultValue={schedule.date||data.date}/></label><label>Heure<input name="start" type="time" required defaultValue={schedule.start||"08:00"}/></label><label>Durée (minutes)<input name="duration" type="number" min={15} max={240} required defaultValue={data.careTypes?.find(t=>t.id===program.careTypeId)?.defaultDuration??30}/></label><label>Salle<input name="room" required defaultValue={schedule.room||"Salle de soins 1"}/></label>{error&&<p role="alert">{error}</p>}<button type="submit">Enregistrer le créneau</button></form>}</DetailDialog></section>;
}
