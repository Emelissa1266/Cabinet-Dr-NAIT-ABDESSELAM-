import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { PrescriptionWorkspace } from "@/features/prescriptions/components/prescription-workspace";
export const metadata = { title: "Ordonnances" };
export default function PrescriptionsPage(){return <DoctorOnly><PrescriptionWorkspace /></DoctorOnly>;}
