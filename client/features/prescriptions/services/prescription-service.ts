import { mockPrescriptions } from "../data/mock-prescriptions";
import type { Prescription, PrescriptionDraft } from "../types";
export interface PrescriptionService { list(): Promise<Prescription[]>; prepare(draft:PrescriptionDraft): Promise<Prescription> }
export const prescriptionService: PrescriptionService = {
 async list() { return structuredClone(mockPrescriptions); },
 async prepare(draft) { return { ...draft, id: `ORD-DEMO-${crypto.randomUUID()}`, doctor:"Dr. Gaya", status:"Brouillon" }; }
};
