import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { RealSurgeryWorkspace } from "@/features/interventions/components/real-surgery-workspace";

export const metadata = { title: "Interventions | Cabinet Dr. Gaya" };

export default function InterventionsPage() {
  return <DoctorOnly><RealSurgeryWorkspace /></DoctorOnly>;
}
