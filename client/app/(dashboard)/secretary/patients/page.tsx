import { PatientList } from "@/features/patients/components/patient-list";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;new?:string}>}){const p=await searchParams;return <PatientList basePath="/secretary/patients" initialQuery={p.q ?? ""} initialCreate={p.new==="1"} />;}
