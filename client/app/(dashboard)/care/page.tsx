import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { RealCareWorkspace } from "@/features/care/components/real-care-workspace";

export const metadata = { title: "Soins" };

export default function CarePage() {
  return <DoctorOnly><RealCareWorkspace /></DoctorOnly>;
}
