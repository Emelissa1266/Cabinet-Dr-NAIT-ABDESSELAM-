import { mockPatients } from "../data/mock-patients";
import type { Patient } from "../types";
export interface PatientService {
  list(): Promise<Patient[]>;
  get(id: string): Promise<Patient | null>;
}
export const patientService: PatientService = {
  async list() { return structuredClone(mockPatients); },
  async get(id) { return structuredClone(mockPatients.find((patient) => patient.id === id) ?? null); },
};
