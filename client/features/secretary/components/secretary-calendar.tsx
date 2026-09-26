"use client";
import {Fragment} from "react";
import {layoutAppointments} from "@/features/agenda/lib/calendar-layout";
import type {Appointment} from "@/features/agenda/types";
import {useSecretary} from "./secretary-provider";
import type {AdminAppointment} from "../types";
import {endTime,patientName} from "../services/admin-state";
import {formatDate} from "@/lib/clinical-format";
import styles from "./secretary.module.css";
export function SecretaryCalendar({appointments,days,week,doctorId,selectedId,onSelect}:{appointments:AdminAppointment[];days:string[];week:boolean;doctorId:string;selectedId?:string;onSelect:(a:AdminAppointment)=>void}){
 const {data}=useSecretary();const groups=week?days.map(day=>({id:day,label:formatDate(day),items:appointments.filter(a=>a.date===day)})):data.doctors.filter(d=>!doctorId||d.id===doctorId).map(d=>({id:d.id,label:d.name,items:appointments.filter(a=>a.doctorId===d.id)}));
 const positioned=groups.map(g=>({...g,events:layoutAppointments(g.items.map((a):Appointment=>({id:a.id,patientId:a.patientId,patient:patientName(data.patients.find(p=>p.id===a.patientId)!),date:a.date,start:a.start,end:endTime(a),type:data.types.find(t=>t.id===a.typeId)!.label,category:"consultation",status:a.status,doctor:data.doctors.find(d=>d.id===a.doctorId)!.name,room:a.room,notes:""})))}));
 const widths=positioned.map(g=>Math.max(1,...g.events.map(e=>e.columns))*240);const grid="64px "+widths.map(w=>"minmax("+w+"px,1fr)").join(" ");
 return <div className={styles.calendarScroll} style={{maxHeight:720}} tabIndex={0} aria-label="Planning clinique, défilement horizontal et vertical"><div className={styles.calendar} style={{gridTemplateColumns:grid,minWidth:64+widths.reduce((a,b)=>a+b,0)}}><div className={styles.calendarHead}>Heure</div>{positioned.map(g=><div className={styles.calendarHead} key={g.id}>{g.label}</div>)}<div className={styles.calendarBody} style={{height:1710}}>{Array.from({length:19},(_,i)=><span key={i} className={styles.hour} style={{top:i*90}}>{String(Math.floor((510+i*30)/60)).padStart(2,"0")}:{i%2===0?"30":"00"}</span>)}</div>{positioned.map(g=><div className={styles.calendarBody} style={{height:1710}} key={g.id}>{g.events.map(e=>{const a=appointments.find(a=>a.id===e.appointment.id)!;return <button key={a.id} className={styles.event} aria-pressed={a.id===selectedId} aria-label={a.start+" "+e.appointment.patient+" "+e.appointment.type+" "+a.status} onClick={()=>onSelect(a)} style={{top:(e.start-510)*3+2,height:(e.end-e.start)*3-4,left:"calc("+e.column*100/e.columns+"% + 4px)",width:"calc("+100/e.columns+"% - 8px)",padding:a.duration<30?4:8}}><strong>{e.appointment.patient}</strong>{a.duration>=30&&<span>{e.appointment.type}</span>}<small>{a.start} – {endTime(a)}</small>{a.duration>=45&&<Fragment><span>{a.room} · {a.status}</span>{week&&<small>{e.appointment.doctor}</small>}</Fragment>}</button>;})}</div>)}</div></div>;
}

