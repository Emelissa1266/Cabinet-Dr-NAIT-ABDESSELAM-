import type {NurseData,NursingProgram,CarePaymentSummary} from "@/features/nurse/types";
import type {SecretaryData,AdminInvoice} from "@/features/secretary/types";
import {invoicePaid} from "@/features/secretary/services/admin-state";
import {careTotal} from "@/features/nurse/services/care-model";
export function careFinancialSummary(data:SecretaryData,program:NursingProgram):CarePaymentSummary{
 const invoice=data.invoices.find(i=>i.careId===program.id);const total=careTotal(program.pricePerSession??0,program.plannedSessions);const paid=invoice?invoicePaid(data,invoice.id):0;
 return {total,paid,remaining:Math.max(0,Math.round((total-paid)*100)/100),status:paid>=total?"Payé":paid>0?"Partiellement payé":"Impayé"};
}
export function syncCareFinance(admin:SecretaryData,nurse:NurseData):SecretaryData{
 const patients=[...admin.patients];for(const p of nurse.patients){if(!patients.some(x=>x.id===p.id)){const [firstName,...last]=p.name.split(" ");patients.push({id:p.id,firstName,lastName:last.join(" "),birthDate:p.birthDate??"",gender:p.gender??"",phone:p.phone,email:p.email??"",address:p.address??"",city:p.city??"",insurance:"",emergencyName:"",emergencyPhone:"",doctorId:"DR-2",status:"À compléter",history:[{date:admin.date,label:"Dossier créé dans le parcours de soins"}]});}}
 const invoices=[...admin.invoices];for(const p of nurse.programs){const index=invoices.findIndex(i=>i.careId===p.id);const old=invoices[index];const invoice:AdminInvoice={...(old??{}),id:old?.id??"FAC-SOIN-"+p.id,scope:"care",careId:p.id,nurseId:p.nurseId,patientId:p.patientId,doctorId:p.doctorId??"DR-2",date:old?.date??admin.date,dueDate:old?.dueDate??admin.date,description:p.name,quantity:p.plannedSessions,unitPrice:p.pricePerSession??0};
 if(invoicePaid(admin,invoice.id)>careTotal(invoice.unitPrice,invoice.quantity))throw new Error("Le total du soin ne peut pas être inférieur aux règlements déjà enregistrés.");
 if(index<0)invoices.push(invoice);else invoices[index]=invoice;}
 return {...admin,patients,invoices};
}
export function initializeFinance(admin:SecretaryData,nurse:NurseData){
 const data=structuredClone(admin);data.patients=data.patients.map(p=>{const n=nurse.patients.find(n=>n.id===p.id);if(!n)return p;const [firstName,...last]=n.name.split(" ");return {...p,firstName,lastName:last.join(" "),phone:n.phone};});data.invoices=data.invoices.map(i=>i.id==="FAC-2026-0050"?{...i,scope:"care",careId:"NP-02"}:i.id==="FAC-2026-0049"?{...i,scope:"care",careId:"NP-03"}:({...i,scope:i.id==="FAC-2026-0048"?"care":"medical"}));
 data.invoices.push({id:"FAC-2026-0051",scope:"medical",patientId:"P-00254",doctorId:"DR-2",date:data.date,dueDate:data.date,description:"Consultation postopératoire",quantity:1,unitPrice:6000});
 return syncCareFinance(data,nurse);
}
export function scopedBilling(data:SecretaryData,nurse:NurseData,role:string):SecretaryData{
 const invoices=role==="SECRETARY"?data.invoices:role==="DOCTOR"?data.invoices.filter(i=>i.scope==="medical"):role==="NURSE"?data.invoices.filter(i=>i.scope==="care"&&i.nurseId===nurse.nurse.id&&nurse.programs.some(p=>p.id===i.careId&&p.nurseId===nurse.nurse.id)):[];
 return {...data,invoices,payments:data.payments.filter(p=>invoices.some(i=>i.id===p.invoiceId)),patients:data.patients.filter(p=>invoices.some(i=>i.patientId===p.id))};
}
