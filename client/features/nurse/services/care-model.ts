import type {NurseData,NursingRecord,NursingSession,CareDraft} from "../types";
export const emptyNursingRecord=():NursingRecord=>({performedTreatment:"",zone:"",device:"",wavelength:"",fluence:"",spotSize:"",frequency:"",tolerance:"",reaction:"",observations:"",incidents:"",notes:""});
export function enrichCareData(source:NurseData):NurseData {
 const data=structuredClone(source);const prices=[3500,15000,12000,4500,7000,3000];
 data.categories=[{id:"pansement",name:"Pansement",description:"Soins prescrits de pansement.",active:true},{id:"laser",name:"Épilation laser",description:"Séances laser prescrites.",active:true},{id:"injection",name:"Assistance au praticien",description:"Assistance uniquement, geste médical réservé au médecin.",active:true},{id:"visage",name:"Soins visage",description:"Protocoles médico-esthétiques.",active:true},{id:"cryo",name:"Cryothérapie",description:"Soins selon prescription.",active:true},{id:"drainage",name:"Drainage lymphatique",description:"Soins selon prescription.",active:true},{id:"postop",name:"Soins postopératoires",description:"Suivi des soins prescrits.",active:true},{id:"photo",name:"Photothérapie",description:"Séances prescrites.",active:true}];
 data.careTypes=data.programs.map((p,i)=>({id:"CT-"+p.id,name:p.name,categoryId:p.laser?"laser":p.category==="Pansement"?"pansement":p.category==="Injection"?"injection":"visage",description:p.name,protocol:p.protocol,defaultDuration:p.laser?45:30,defaultSessions:p.plannedSessions,defaultPricePerSession:prices[i],requiredParameters:p.laser?["device","wavelength","fluence","spotSize","frequency"]:[],active:true}));
 data.programs=data.programs.map((p,i)=>{const type=data.careTypes![i];const prior=p.priorCompleted;const sessions=data.sessions.filter(s=>s.programId===p.id).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));sessions.forEach((s,index)=>s.sessionNumber=prior+index+1);
 for(let n=1;n<=prior;n++)data.sessions.push({id:p.id+"-H"+n,programId:p.id,nurseId:data.nurse.id,sessionNumber:n,date:"2026-09-"+String(n*7).padStart(2,"0"),start:"10:00",end:"10:45",room:"Salle de soins",status:"Terminé",startedAt:"2026-09-"+String(n*7).padStart(2,"0")+"T09:00:00Z",completedAt:"2026-09-"+String(n*7).padStart(2,"0")+"T09:45:00Z",validatedAt:"2026-09-"+String(n*7).padStart(2,"0")+"T09:45:00Z",record:{...emptyNursingRecord(),performedTreatment:p.name,zone:p.zone,tolerance:"Bonne",reaction:"Aucune",observations:"Séance historique de démonstration validée."}});
 for(let n=prior+sessions.length+1;n<=p.plannedSessions;n++)data.sessions.push(unscheduledSession(p.id,n,data.nurse.id));
 return {...p,priorCompleted:0,careTypeId:type.id,categoryId:type.categoryId,nurseId:data.nurse.id,doctorId:p.doctor==="Dr. Meziane"?"DR-3":"DR-2",pricePerSession:prices[i]};});
 return data;
}
export function unscheduledSession(programId:string,number:number,nurseId:string):NursingSession{return {id:programId+"-S"+number,programId,nurseId,sessionNumber:number,date:"",start:"",end:"",room:"",status:"À planifier",record:emptyNursingRecord()};}
export function careTotal(price:number,count:number){return Math.round(price*count*100)/100;}
export function saveCare(data:NurseData,draft:CareDraft):NurseData {
 const type=data.careTypes?.find(t=>t.id===draft.careTypeId&&t.active);const existing=data.programs.find(p=>p.id===draft.id);
 if(!type||!data.patients.some(p=>p.id===draft.patientId)||!draft.doctorId||!draft.doctor||!draft.zone.trim()||!Number.isInteger(draft.plannedSessions)||draft.plannedSessions<1||draft.plannedSessions>60||!Number.isFinite(draft.pricePerSession)||draft.pricePerSession<0||Math.abs(draft.pricePerSession*100-Math.round(draft.pricePerSession*100))>0.00001)throw new Error("Vérifiez le patient, le type, le praticien, la zone, le nombre de séances et le prix.");
 const patient=data.patients.find(p=>p.id===draft.patientId);if(patient?.createdBy!==data.nurse.id&&!data.programs.some(p=>p.patientId===draft.patientId&&p.nurseId===data.nurse.id))throw new Error("Patient hors de votre périmètre de soins.");
 if(existing&&(existing.nurseId!==data.nurse.id||existing.patientId!==draft.patientId||existing.careTypeId!==draft.careTypeId))throw new Error("Le patient et le type du soin existant ne peuvent pas être remplacés.");
 const sessions=data.sessions.filter(s=>s.programId===draft.id);const protectedCount=Math.max(0,...sessions.filter(s=>s.status!=="À planifier").map(s=>s.sessionNumber??0));
 if(draft.plannedSessions<protectedCount)throw new Error("Le nombre prévu ne peut pas supprimer des séances déjà planifiées ou réalisées.");
 const program={...(existing??{}),id:draft.id,patientId:draft.patientId,careTypeId:type.id,categoryId:type.categoryId,nurseId:data.nurse.id,doctorId:draft.doctorId,name:type.name,category:data.categories?.find(c=>c.id===type.categoryId)?.name??"Soins",doctor:draft.doctor,plannedSessions:draft.plannedSessions,priorCompleted:0,pricePerSession:draft.pricePerSession,protocol:existing?.protocol??type.protocol,zone:draft.zone};
 const updated=data.sessions.filter(s=>s.programId!==draft.id||(s.sessionNumber??0)<=draft.plannedSessions);
 for(let n=1;n<=draft.plannedSessions;n++)if(!updated.some(s=>s.programId===draft.id&&s.sessionNumber===n))updated.push(unscheduledSession(draft.id,n,data.nurse.id));
 return {...data,programs:existing?data.programs.map(p=>p.id===draft.id?program:p):[...data.programs,program],sessions:updated};
}
export function scheduleSession(data:NurseData,id:string,date:string,start:string,duration:number,room:string):NurseData{
 const session=data.sessions.find(s=>s.id===id&&s.nurseId===data.nurse.id);if(!session||!["À planifier","Planifié"].includes(session.status))throw new Error("Cette séance ne peut pas être replanifiée.");
 const time=Date.parse(date+"T12:00:00Z");const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));const begin=minutes(start);
 if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!Number.isInteger(duration)||duration<15||duration>240||begin<480||begin+duration>1200||!room.trim())throw new Error("Vérifiez la date, la durée, la salle et l’heure (08:00–20:00).");
 const patientId=data.programs.find(p=>p.id===session.programId)!.patientId;
 if(data.sessions.some(s=>s.id!==id&&s.date===date&&!["Annulé","À planifier"].includes(s.status)&&(s.nurseId===session.nurseId||s.room.toLowerCase()===room.trim().toLowerCase()||data.programs.find(p=>p.id===s.programId)?.patientId===patientId)&&begin<minutes(s.end)&&minutes(s.start)<begin+duration))throw new Error("Créneau occupé : infirmière, patient ou salle déjà réservé.");
 const end=String(Math.floor((begin+duration)/60)).padStart(2,"0")+":"+String((begin+duration)%60).padStart(2,"0");
 return {...data,sessions:data.sessions.map(s=>s.id===id?{...s,date,start,end,room:room.trim(),status:"Planifié"}:s)};
}

