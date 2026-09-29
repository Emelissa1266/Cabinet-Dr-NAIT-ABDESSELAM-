import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { PrescriptionWorkspace } from "@/features/prescriptions/components/prescription-workspace";
import { prescriptionService } from "@/features/prescriptions/services/prescription-service";
import { mockPatients } from "@/features/patients/data/mock-patients";
export const metadata = { title: "Ordonnances" };
export default async function PrescriptionsPage(){const prescriptions=await prescriptionService.list();return <DoctorOnly><PrescriptionWorkspace initialPrescriptions={prescriptions} patients={mockPatients}/></DoctorOnly>;}
