"use client";
import {useClinic} from "@/features/clinic/components/clinic-provider";
export function useNurse(){const {nurse,executeNurse}=useClinic();const programs=nurse.programs.filter(p=>p.nurseId===nurse.nurse.id);const data={...nurse,programs,sessions:nurse.sessions.filter(s=>s.nurseId===nurse.nurse.id&&programs.some(p=>p.id===s.programId)),patients:nurse.patients.filter(p=>p.createdBy===nurse.nurse.id||programs.some(c=>c.patientId===p.id)),photos:nurse.photos.filter(p=>programs.some(c=>c.id===p.programId))};return {data,execute:executeNurse};}
