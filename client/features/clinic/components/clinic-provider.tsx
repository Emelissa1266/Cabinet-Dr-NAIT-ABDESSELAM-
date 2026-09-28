"use client";
import {createContext,useContext,useState,useRef,type ReactNode} from "react";
import type {CareData} from "@/features/care/types";
import {mockCare} from "@/features/care/data/mock-care";
import {medicalCatalogue,nurseCatalogue} from "../services/care-catalogue";
import {useAuth} from "@/features/auth/components/auth-provider";
import {initializeFinance,syncCareFinance} from "../services/care-finance";
import {enrichCareData} from "@/features/nurse/services/care-model";
import {mockNurse} from "@/features/nurse/data/mock-nurse";
import {mockSecretary} from "@/features/secretary/data/mock-secretary";
import {applySessionAction} from "@/features/nurse/services/session-state";
import {applyAdminAction} from "@/features/secretary/services/admin-state";
import type {NurseData,NursingAction} from "@/features/nurse/types";
import type {SecretaryData,SecretaryAction} from "@/features/secretary/types";
interface ClinicState {medicalCare:CareData;nurse:NurseData;admin:SecretaryData}
interface ClinicContext extends ClinicState {setMedicalCare:(value:CareData|((data:CareData)=>CareData))=>void;executeNurse:(action:NursingAction)=>void;executeAdmin:(action:SecretaryAction)=>void}
const Context=createContext<ClinicContext|null>(null);
export function ClinicProvider({children}:{children:ReactNode}){
 const {user}=useAuth();const [state,setState]=useState<ClinicState>(()=>{const base=enrichCareData(mockNurse);const medicalCare=medicalCatalogue(mockCare,base);const nurse=nurseCatalogue(base,medicalCare);return {medicalCare,nurse,admin:initializeFinance(mockSecretary,nurse)};});const current=useRef(state);
 function commit(next:ClinicState){current.current=next;setState(next);}
 function executeNurse(action:NursingAction){if(user?.role!=="NURSE")throw new Error("Action réservée au personnel soignant.");if(action.type==="care"&&!current.current.admin.doctors.some(d=>d.id===action.care.doctorId&&d.name===action.care.doctor))throw new Error("Praticien invalide.");const nurse=applySessionAction(current.current.nurse,action);let admin=syncCareFinance(current.current.admin,nurse);if(action.type==="patient"){const p=action.patient;const [firstName,...last]=p.name.trim().split(" ");admin={...admin,patients:admin.patients.map(x=>x.id===p.id?{...x,firstName,lastName:last.join(" "),phone:p.phone,birthDate:p.birthDate??x.birthDate,gender:p.gender??x.gender,email:p.email??"",address:p.address??"",city:p.city??""}:x)};}commit({...current.current,nurse,admin});}
 function executeAdmin(action:SecretaryAction){if(user?.role!=="SECRETARY")throw new Error("Action réservée au secrétariat.");const admin=applyAdminAction(current.current.admin,action);let nurse=current.current.nurse;if(action.type==="patient"){const p=action.patient;let age=Number(nurse.date.slice(0,4))-Number(p.birthDate.slice(0,4));if(nurse.date.slice(5)<p.birthDate.slice(5))age--;nurse={...nurse,patients:nurse.patients.map(x=>x.id===p.id?{...x,name:p.firstName+" "+p.lastName,initials:p.firstName[0]+p.lastName[0],age,birthDate:p.birthDate,gender:p.gender,phone:p.phone,email:p.email,address:p.address,city:p.city}:x)};}commit({...current.current,admin,nurse});}
 function setMedicalCare(value:CareData|((data:CareData)=>CareData)){if(user?.role!=="DOCTOR")throw new Error("Catalogue réservé au médecin.");const medicalCare=typeof value==="function"?value(current.current.medicalCare):value;commit({...current.current,medicalCare,nurse:nurseCatalogue(current.current.nurse,medicalCare)});}
 return <Context.Provider value={{...state,executeNurse,executeAdmin,setMedicalCare}}>{children}</Context.Provider>;
}
export function useClinic(){const context=useContext(Context);if(!context)throw new Error("ClinicProvider required");return context;}

