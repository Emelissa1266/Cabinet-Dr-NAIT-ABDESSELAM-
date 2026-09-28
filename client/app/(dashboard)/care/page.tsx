import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { CareWorkspace } from "@/features/care/components/care-workspace";
import { careService } from "@/features/care/services/care-service";
import { patientService } from "@/features/patients/services/patient-service";
export const metadata = { title: "Soins" };
export default async function CarePage() { const [data,patients]=await Promise.all([careService.getOverview(),patientService.list()]);return <DoctorOnly><CareWorkspace initialData={data} patients={patients}/></DoctorOnly>; }
