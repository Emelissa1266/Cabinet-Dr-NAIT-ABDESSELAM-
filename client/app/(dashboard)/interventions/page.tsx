import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { InterventionProgram } from "@/features/interventions/components/intervention-program";
import { interventionService } from "@/features/interventions/services/intervention-service";
export const metadata = { title: "Interventions | Cabinet Dr. Gaya" };
export default async function InterventionsPage(){return <DoctorOnly><InterventionProgram data={await interventionService.getProgram()}/></DoctorOnly>;}
