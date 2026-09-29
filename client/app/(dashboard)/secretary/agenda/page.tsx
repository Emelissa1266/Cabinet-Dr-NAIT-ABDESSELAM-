import { AgendaCalendar } from "@/features/agenda/components/agenda-calendar";
export default async function Page({searchParams}:{searchParams:Promise<{new?:string;patient?:string;appointment?:string}>}){const p=await searchParams;return <AgendaCalendar basePath="/secretary/agenda" initialCreate={p.new==="1"} initialPatientId={p.patient} />;}
