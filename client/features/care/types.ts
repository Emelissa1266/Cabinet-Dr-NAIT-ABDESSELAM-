export interface CareCategory { id: string; name: string; description: string; active: boolean }
export type TreatmentStatus = "Planifié" | "En cours" | "Suspendu" | "Terminé";
export interface CareSession { id: string; date: string; status: "Réalisée" | "Planifiée" | "Annulée"; notes: string }
export interface CareNurse { id: string; name: string; initials: string }
export interface CareProtocol { description?:string; defaultSessions?:number; defaultPricePerSession?:number; requiredParameters?:("device"|"wavelength"|"fluence"|"spotSize"|"frequency")[]; id: string; categoryId: string; name: string; instructions: string; durationMinutes: number; active: boolean }
export interface CarePlanning {
 date: string; time: string; room: string; nurseId: string; doctor: string;
 durationMinutes: number; instructions: string; startedAt?: string; alert?: string;
 parameters: { label: string; value: string }[]; zone: string; phototype?: string;
 tolerance?: "Bonne" | "Moyenne" | "Difficile"; observations: string;
}
export interface CareTreatment {
 id: string; patientId: string; categoryId: string; type: string; plannedSessions: number;
 pricePerSession: number; status: TreatmentStatus; startDate: string; notes: string; sessions: CareSession[]; planning?: CarePlanning;
}
export interface CareData { categories: CareCategory[]; treatments: CareTreatment[]; nurses: CareNurse[]; protocols: CareProtocol[]; planningDate: string }
export type TreatmentDraft = Omit<CareTreatment, "id" | "sessions">;
export const completedSessions = (treatment: CareTreatment) => treatment.sessions.filter(session => session.status === "Réalisée").length;
