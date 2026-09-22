import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { AgendaCalendar } from "@/features/agenda/components/agenda-calendar";
import { agendaService } from "@/features/agenda/services/agenda-service";
import { demoDate } from "@/features/agenda/data/mock-agenda";
export const metadata = { title: "Agenda | Cabinet Dr. Gaya" };
export default async function AgendaPage() { return <DoctorOnly><AgendaCalendar appointments={await agendaService.list()} initialDate={demoDate} /></DoctorOnly>; }
