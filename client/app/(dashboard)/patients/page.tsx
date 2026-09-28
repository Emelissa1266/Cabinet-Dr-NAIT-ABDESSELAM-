import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { PatientList } from "@/features/patients/components/patient-list";
import { patientService } from "@/features/patients/services/patient-service";
export const metadata = { title: "Patients" };
export default async function PatientsPage() {
  return <DoctorOnly><PatientList patients={await patientService.list()} /></DoctorOnly>;
}
