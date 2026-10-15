import {DoctorOnly} from "@/features/auth/components/doctor-only";
import {WorkLeavesWorkspace} from "@/features/work-leaves/components/work-leaves-workspace";
export const metadata = {title: "Arrêts de travail"};
export default async function WorkLeavesPage({searchParams}: {searchParams: Promise<{consultation?: string; patient?: string}>}) {
  const params=await searchParams;const id=Number(params.consultation);const patientId=Number(params.patient);
  return <DoctorOnly><WorkLeavesWorkspace patientIdFilter={Number.isInteger(patientId) && patientId>0 ? patientId : undefined} consultationFilter={Number.isInteger(id) && id > 0 ? id : undefined}/></DoctorOnly>;
}
