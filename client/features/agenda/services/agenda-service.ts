import { mockAppointments } from "../data/mock-agenda";
import type { Appointment } from "../types";
interface AgendaService { list(): Promise<Appointment[]> }
export const agendaService: AgendaService = { async list() { return structuredClone(mockAppointments); } };
