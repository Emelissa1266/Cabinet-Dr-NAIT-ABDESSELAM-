export type AppointmentStatus="À confirmer"|"Confirmé"|"Arrivé"|"En consultation"|"Terminé"|"Annulé";
export interface AdminPatient {id:string;firstName:string;lastName:string;birthDate:string;gender:string;phone:string;email:string;address:string;city:string;insurance:string;emergencyName:string;emergencyPhone:string;doctorId:string;status:"Actif"|"À compléter"|"Archivé";history:{date:string;label:string}[]}
export interface AppointmentType {id:string;label:string;duration:number;price:number}
export interface AdminAppointment {id:string;patientId:string;doctorId:string;typeId:string;date:string;start:string;duration:number;room:string;reason:string;notes:string;status:AppointmentStatus}
export interface AdminInvoice {scope?:"medical"|"care";careId?:string;nurseId?:string;id:string;patientId:string;doctorId:string;appointmentId?:string;date:string;dueDate:string;description:string;quantity:number;unitPrice:number}
export type PaymentMethod="Espèces"|"Carte"|"Virement"|"Autre";
export interface AdminPayment {id:string;invoiceId:string;amount:number;method:PaymentMethod;date:string;reference:string;notes:string}
export interface SecretaryData {date:string;patients:AdminPatient[];appointments:AdminAppointment[];types:AppointmentType[];doctors:{id:string;name:string;specialty:string}[];rooms:string[];invoices:AdminInvoice[];payments:AdminPayment[]}
export type SecretaryAction={type:"patient";patient:AdminPatient}|{type:"appointment";appointment:AdminAppointment}|{type:"status";id:string;status:AppointmentStatus}|{type:"invoice";invoice:AdminInvoice}|{type:"payment";payment:AdminPayment}|{type:"appointment-type";appointmentType:AppointmentType};

