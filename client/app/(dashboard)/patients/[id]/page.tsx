import { notFound } from "next/navigation";
import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { PatientDetail } from "@/features/patients/components/patient-detail";
import { patientService } from "@/features/patients/services/patient-service";
import { sarahRecord } from "@/features/patients/data/mock-patient-record";
export const metadata = { title: "Dossier patient" };
export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = await patientService.get(id);
  if (!patient) notFound();
  return <DoctorOnly><PatientDetail patient={patient} record={id === "P-00254" ? sarahRecord : null} /></DoctorOnly>;
}
