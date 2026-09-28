export interface PrescriptionMedication { id: string; name: string; dosage: string; frequency: string; duration: string; instructions: string }
export interface Prescription { id: string; patientId: string; date: string; doctor: string; status: "Brouillon" | "Enregistrée"; medications: PrescriptionMedication[]; notes: string }
export type PrescriptionDraft = Omit<Prescription, "id" | "doctor" | "status">;
