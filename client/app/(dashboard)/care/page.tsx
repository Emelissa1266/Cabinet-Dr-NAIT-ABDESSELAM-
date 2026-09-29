import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { CareWorkspace } from "@/features/care/components/care-workspace";
import { careService } from "@/features/care/services/care-service";
import { mockPatients } from "@/features/patients/data/mock-patients";
export const metadata = { title: "Soins" };
export default async function CarePage() { const data=await careService.getOverview();return <DoctorOnly><CareWorkspace initialData={data} patients={mockPatients}/></DoctorOnly>; }
