import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { PrescriptionWorkspace } from "@/features/prescriptions/components/prescription-workspace";
import { prescriptionService } from "@/features/prescriptions/services/prescription-service";
import { patientService } from "@/features/patients/services/patient-service";
export const metadata = { title: "Ordonnances" };
export default async function PrescriptionsPage(){const [prescriptions,patients]=await Promise.all([prescriptionService.list(),patientService.list()]);return <DoctorOnly><PrescriptionWorkspace initialPrescriptions={prescriptions} patients={patients}/></DoctorOnly>;}
