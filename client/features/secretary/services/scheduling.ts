import type {AdminAppointment,SecretaryData} from "../types";
export const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3));
export function validDate(value:string){const time=Date.parse(value+"T12:00:00Z");return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;}
export function appointmentError(data:SecretaryData,a:AdminAppointment):string|null {
 if(!data.patients.some(p=>p.id===a.patientId&&p.status!=="Archivé"))return "Sélectionnez un patient actif.";
 if(!data.doctors.some(d=>d.id===a.doctorId)||!data.types.some(t=>t.id===a.typeId)||!data.rooms.includes(a.room))return "Sélectionnez un praticien, un type et une salle valides.";
 if(!validDate(a.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.start)||!Number.isInteger(a.duration)||a.duration<15||a.duration>240||minutes(a.start)<510||minutes(a.start)+a.duration>1080)return "Choisissez une durée de 15 à 240 min entre 08:30 et 18:00.";
 const conflict=data.appointments.find(other=>other.id!==a.id&&other.date===a.date&&other.status!=="Annulé"&&(other.doctorId===a.doctorId||other.room===a.room||other.patientId===a.patientId)&&minutes(a.start)<minutes(other.start)+other.duration&&minutes(other.start)<minutes(a.start)+a.duration);
 if(conflict)return "Conflit de planning : "+(conflict.patientId===a.patientId?"patient":conflict.doctorId===a.doctorId?"praticien":"salle")+" déjà occupé(e) à "+conflict.start+".";
 return null;
}
export function freeSlots(data:SecretaryData,appointment:AdminAppointment){const slots:string[]=[];for(let m=510;m+appointment.duration<=1080;m+=15){const start=String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");if(!appointmentError(data,{...appointment,start}))slots.push(start);}return slots;}
export function shiftDate(date:string,days:number){const next=new Date(date+"T12:00:00Z");next.setUTCDate(next.getUTCDate()+days);return next.toISOString().slice(0,10);}

