export type NursingStatus = "À planifier" | "Planifié" | "En cours" | "Terminé" | "Annulé" | "À revoir";
export interface CareCategory {id:string;name:string;description:string;active:boolean}
export interface CareType {id:string;name:string;categoryId:string;description:string;protocol:string;defaultDuration:number;defaultSessions:number;defaultPricePerSession:number;requiredParameters:("device"|"wavelength"|"fluence"|"spotSize"|"frequency")[];active:boolean}
export interface CarePricing {pricePerSession:number;plannedSessions:number}
export interface CarePaymentSummary {total:number;paid:number;remaining:number;status:"Payé"|"Partiellement payé"|"Impayé"}
export interface NursePatient {
    id: string;
    name: string;
    age: number;
    initials: string;
    phone: string;
    birthDate?: string; gender?: string; email?: string; address?: string; city?: string; createdBy?: string;
    allergies: string;
    phototype: string;
    precautions: string;
    relevantHistory: string;
    intervention?: {
        name: string;
        date: string;
        doctor: string;
        followUp: string;
    };
    vitals?: {
        label: string;
        value: string;
    }[];
}
export interface NursingProgram {
    careTypeId?:string; categoryId?:string; nurseId?:string; doctorId?:string; pricePerSession?:number;
    id: string;
    patientId: string;
    name: string;
    category: string;
    plannedSessions: number;
    priorCompleted: number;
    doctor: string;
    protocol: string;
    zone: string;
    laser?: {
        type: string;
        device: string;
        wavelength: string;
        fluence: string;
        spotSize: string;
        frequency: string;
    };
}
export interface NursingRecord {
    performedTreatment: string;
    zone: string;
    device: string;
    wavelength: string;
    fluence: string;
    spotSize: string;
    frequency: string;
    tolerance: "" | "Bonne" | "Moyenne" | "Difficile";
    reaction: "" | "Aucune" | "Légère" | "Importante";
    observations: string;
    incidents: string;
    notes: string;
}
export interface NursingSession {
    sessionNumber?:number;
    id: string;
    programId: string;
    nurseId: string;
    date: string;
    start: string;
    end: string;
    room: string;
    status: NursingStatus;
    startedAt?: string;
    completedAt?: string;
    validatedAt?: string;
    draftSavedAt?: string;
    record: NursingRecord;
}
export interface NursingPhoto {
    id: string;
    patientId: string;
    programId: string;
    pairId: string;
    phase: "Avant" | "Après";
    date: string;
    zone: string;
    sessionNumber: number;
    category: string;
    notes: string;
    image: {
        src: string;
        width: number;
        height: number;
        alt: string;
    };
}
export interface NurseData {
    categories?:CareCategory[]; careTypes?:CareType[];
    date: string;
    nurse: {
        id: string;
        name: string;
        title: string;
    };
    patients: NursePatient[];
    programs: NursingProgram[];
    sessions: NursingSession[];
    photos: NursingPhoto[];
}
export interface CareDraft {id:string;patientId:string;careTypeId:string;doctorId:string;doctor:string;plannedSessions:number;pricePerSession:number;zone:string;date:string;start:string;room:string}
export type NursingAction = {type:"care";care:CareDraft} | {type:"schedule";id:string;date:string;start:string;duration:number;room:string} | {type:"patient";patient:Pick<NursePatient,"id"|"name"|"phone"|"birthDate"|"gender"|"email"|"address"|"city">;at:string} | {
    type: "start";
    id: string;
    at: string;
} | {
    type: "draft";
    id: string;
    record: NursingRecord;
    at: string;
} | {
    type: "complete";
    id: string;
    record: NursingRecord;
    at: string;
} | {
    type: "report";
    id: string;
    message: string;
    at: string;
};
