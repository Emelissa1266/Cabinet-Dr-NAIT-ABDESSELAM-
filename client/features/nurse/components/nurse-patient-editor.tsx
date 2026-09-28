"use client";
import {useRouter} from "next/navigation";
import {PatientForm} from "@/features/secretary/components/patient-form";
import {useSecretary} from "@/features/secretary/components/secretary-provider";
import {useNurse} from "./nurse-provider";
import type {NursePatient} from "../types";
import type {AdminPatient} from "@/features/secretary/types";
export function NursePatientEditor({patient,onClose}:{patient?:NursePatient;onClose:()=>void}){
 const {data,execute}=useNurse();const {data:admin}=useSecretary();const router=useRouter();const administrative=patient?admin.patients.find(p=>p.id===patient.id):undefined;
 const initial:AdminPatient|undefined=patient?{id:patient.id,firstName:patient.name.split(" ")[0],lastName:patient.name.split(" ").slice(1).join(" "),birthDate:patient.birthDate??administrative?.birthDate??"",gender:patient.gender??administrative?.gender??"Non précisé",phone:patient.phone,email:patient.email??administrative?.email??"",address:patient.address??administrative?.address??"",city:patient.city??administrative?.city??"",insurance:"",emergencyName:"",emergencyPhone:"",doctorId:administrative?.doctorId??admin.doctors[0].id,status:"Actif",history:[]}:undefined;
 function save(p:AdminPatient){execute({type:"patient",patient:{id:p.id,name:p.firstName+" "+p.lastName,birthDate:p.birthDate,gender:p.gender,phone:p.phone,email:p.email,address:p.address,city:p.city},at:data.date});}
 return <PatientForm patient={initial} careOnly onSubmitPatient={save} onCancel={onClose} onSave={(id)=>{onClose();router.push("/nurse/patients/"+id);}}/>;
}

