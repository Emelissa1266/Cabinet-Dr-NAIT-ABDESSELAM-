import {saveCare,scheduleSession} from "./care-model";
import type { NurseData, NursingAction, NursingProgram, NursingRecord } from "../types";
export function programProgress(data: NurseData, program: NursingProgram) {
    const completed = program.priorCompleted + data.sessions.filter(s => s.programId === program.id && s.status === "Terminé" && s.validatedAt).length;
    const current=data.sessions.filter(s=>s.programId===program.id&&s.status==="En cours").length;
    return { completed,current, remaining: Math.max(0, program.plannedSessions - completed-current),remainingToComplete:Math.max(0,program.plannedSessions-completed), total: program.plannedSessions };
}
export function validateRecord(record: NursingRecord, laser: boolean): string | null {
    if (![record.performedTreatment, record.zone, record.observations].every(value => value.trim()) || !record.tolerance || !record.reaction)
        return "Renseignez le soin réalisé, la zone, la tolérance, la réaction et les observations.";
    if (laser && (![record.device, record.wavelength].every(value => value.trim()) || [record.fluence, record.spotSize, record.frequency].some(value => !value.trim() || !Number.isFinite(Number(value)) || Number(value) <= 0)))
        return "Renseignez l’appareil, la longueur d’onde et les paramètres utilisés.";
    if ((record.reaction === "Importante" || record.tolerance === "Difficile") && !record.incidents.trim())
        return "Décrivez l’incident pour transmission au praticien.";
    return null;
}
/** Pure transitions: immutable prescriptions, completed-session lock and idempotent completion. */
export function applySessionAction(data: NurseData, action: NursingAction): NurseData {
    if(action.type==="care")return saveCare(data,action.care);
    if(action.type==="schedule")return scheduleSession(data,action.id,action.date,action.start,action.duration,action.room);
    if(action.type === "patient") {const p=action.patient;const birth=Date.parse((p.birthDate??"")+"T12:00:00Z");if(!p.name.trim()||!/^\+?[\d ()-]{8,20}$/.test(p.phone)||!Number.isFinite(birth)||!p.birthDate||new Date(birth).toISOString().slice(0,10)!==p.birthDate||p.birthDate>data.date||p.birthDate<"1900-01-01")throw new Error("Vérifiez le nom, la naissance et le téléphone.");if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))throw new Error("Adresse e-mail invalide.");const previous=data.patients.find(x=>x.id===p.id);if(previous&&previous.createdBy!==data.nurse.id&&!data.programs.some(c=>c.patientId===p.id&&c.nurseId===data.nurse.id))throw new Error("Patient hors de votre périmètre de soins.");let age=Number(data.date.slice(0,4))-Number(p.birthDate.slice(0,4));if(data.date.slice(5)<p.birthDate.slice(5))age--;const patient={...(previous??{allergies:"Non renseignées — à vérifier avec le praticien.",phototype:"Non renseigné",precautions:"Consulter les instructions du soin prescrit.",relevantHistory:"Aucun antécédent pertinent documenté.",createdBy:data.nurse.id}),id:p.id,name:p.name.trim(),phone:p.phone,birthDate:p.birthDate,gender:p.gender,email:p.email,address:p.address,city:p.city,age,initials:p.name.split(" ").map(s=>s[0]).slice(0,2).join("")};return {...data,patients:previous?data.patients.map(x=>x.id===p.id?patient:x):[...data.patients,patient]};}
    const session = data.sessions.find(s => s.id === action.id && s.nurseId === data.nurse.id);
    if (!session)
        throw new Error("Cette séance ne vous est pas assignée.");
    const program = data.programs.find(p => p.id === session.programId);
    if (!program)
        throw new Error("Programme introuvable.");
    if (session.status === "Terminé") {
        if (action.type === "complete")
            return data;
        throw new Error("La séance validée est en lecture seule.");
    }
    if(action.type==="start"&&programProgress(data,program).current>0)throw new Error("Une séance de ce soin est déjà en cours.");
    if (action.type === "start" && session.status !== "Planifié")
        throw new Error("Seule une séance planifiée peut être démarrée.");
    if (action.type === "start" && programProgress(data, program).remaining === 0)
        throw new Error("Toutes les séances du programme sont déjà réalisées.");
    if ((action.type === "draft" || action.type === "complete") && session.status !== "En cours")
        throw new Error("Démarrez le soin avant de saisir la réalisation.");
    if (action.type === "complete") {
        const required=data.careTypes?.find(t=>t.id===program.careTypeId)?.requiredParameters??[];
        if(required.some(key=>!action.record[key].trim()||(key!=="device"&&(!Number.isFinite(Number(action.record[key]))||Number(action.record[key])<=0))))throw new Error("Renseignez les paramètres obligatoires du protocole.");
        const error = validateRecord(action.record, Boolean(program.laser));
        if (error)
            throw new Error(error);
        if (programProgress(data, program).remainingToComplete === 0)
            throw new Error("Le programme est déjà terminé.");
    }
    if (action.type === "report" && (!action.message.trim() || session.status === "Annulé"))
        throw new Error("Renseignez un signalement pour une séance active.");
    const updated = action.type === "start" ? { ...session, status: "En cours" as const, startedAt: action.at }
        : action.type === "draft" ? { ...session, record: { ...action.record }, draftSavedAt: action.at }
            : action.type === "report" ? { ...session, status: "À revoir" as const, record: { ...session.record, incidents: action.message.trim() }, draftSavedAt: action.at }
                : { ...session, record: { ...action.record }, status: "Terminé" as const, completedAt: action.at, validatedAt: action.at };
    return { ...data, sessions: data.sessions.map(s => s.id === session.id ? updated : s) };
}
