import type { CareData } from "../types";
const existingCare: Pick<CareData, "categories" | "treatments"> = {
 categories: [
 { id: "laser", name: "Laser", description: "Protocoles laser définis par le praticien.", active: true },
 { id: "epilation", name: "Épilation", description: "Programmes d’épilation par zone.", active: true },
 { id: "aesthetic", name: "Soins esthétiques", description: "Soins cutanés et entretien.", active: true }
 ],
 treatments: [
 { id: "S-001", patientId: "P-00260", categoryId: "epilation", type: "Épilation — jambes", plannedSessions: 6, pricePerSession: 8000, status: "En cours", startDate: "2026-08-12", notes: "Programme indépendant d’une consultation. Réévaluer la tolérance avant la prochaine séance.", sessions: [{id:"s1",date:"2026-08-12",status:"Réalisée",notes:"Séance initiale enregistrée par le personnel soignant."},{id:"s2",date:"2026-09-12",status:"Réalisée",notes:"Bonne tolérance documentée."},{id:"s3",date:"2026-10-12",status:"Planifiée",notes:"Contrôle avant réalisation."}] },
 { id: "S-002", patientId: "P-00254", categoryId: "laser", type: "Suivi cicatriciel", plannedSessions: 4, pricePerSession: 6000, status: "Planifié", startDate: "2026-10-01", notes: "Protocole à confirmer par le praticien.", sessions: [] },
 { id: "S-003", patientId: "P-00255", categoryId: "aesthetic", type: "Soin hydratant", plannedSessions: 2, pricePerSession: 4500, status: "Terminé", startDate: "2026-08-05", notes: "Programme terminé.", sessions: [{id:"s4",date:"2026-08-05",status:"Réalisée",notes:"Séance 1."},{id:"s5",date:"2026-08-19",status:"Réalisée",notes:"Fin de programme."}] }
 ]
};

const planningDate = "2026-09-18";
const schedules = [
 { time: "09:30", room: "Salle Laser 2", nurseId: "n1", durationMinutes: 45, instructions: "Vérifier le protocole prescrit, la tolérance et les précautions avant chaque séance.", parameters: [{ label: "Appareil", value: "Laser Alexandrite" }, { label: "Longueur d’onde", value: "755 nm" }, { label: "Zone", value: "Jambes" }], zone: "Jambes complètes", phototype: "III", tolerance: "Bonne" as const, startedAt: "09:32", observations: "Tolérance rapportée par le personnel soignant. Paramètres de démonstration." },
 { time: "10:30", room: "Box Pansement", nurseId: "n1", durationMinutes: 30, instructions: "Évaluer l’évolution cicatricielle avant de confirmer le protocole.", parameters: [], zone: "Zone cicatricielle", observations: "Protocole en attente de confirmation.", alert: "À vérifier" },
 { time: "11:30", room: "Cabine Dermato", nurseId: "n2", durationMinutes: 40, instructions: "Suivre les consignes du programme de soins.", parameters: [], zone: "Visage", tolerance: "Bonne" as const, observations: "Programme terminé, bonne tolérance." },
];

export const mockCare: CareData = {
 ...existingCare,
 planningDate,
 nurses: [{ id: "n1", name: "Nadia M.", initials: "NM" }, { id: "n2", name: "Sonia B.", initials: "SB" }],
 protocols: [
  { id: "pr1", categoryId: "epilation", name: "Épilation laser médicale", durationMinutes: 45, instructions: "Vérifier le protocole prescrit, la tolérance et les précautions avant chaque séance.", active: true },
  { id: "pr2", categoryId: "laser", name: "Suivi cicatriciel", durationMinutes: 30, instructions: "Évaluation médicale préalable des paramètres du traitement.", active: true },
  { id: "pr3", categoryId: "aesthetic", name: "Soin hydratant", durationMinutes: 40, instructions: "Respecter les consignes du programme personnalisé.", active: true },
 ],
 treatments: [
  ...existingCare.treatments.map((treatment, index) => ({ ...treatment, planning: { ...schedules[index], date: planningDate, doctor: "Dr. Gaya" } })),
  { id: "S-004", patientId: "P-00239", categoryId: "aesthetic", type: "Drainage lymphatique", plannedSessions: 4, pricePerSession: 5000, status: "Planifié", startDate: planningDate, notes: "Programme de démonstration.", sessions: [], planning: { date: planningDate, time: "14:00", room: "Salle Soins 2", nurseId: "n2", doctor: "Dr. Gaya", durationMinutes: 40, instructions: "Suivre le protocole personnalisé du praticien.", parameters: [], zone: "Visage", observations: "" } },
  { id: "S-005", patientId: "P-00215", categoryId: "aesthetic", type: "Soin visage", plannedSessions: 1, pricePerSession: 4500, status: "Terminé", startDate: planningDate, notes: "", sessions: [{ id: "s6", date: planningDate, status: "Réalisée", notes: "Soin terminé." }], planning: { date: planningDate, time: "15:30", room: "Cabine Dermato", nurseId: "n1", doctor: "Dr. Gaya", durationMinutes: 45, instructions: "Respecter le protocole de soin prescrit.", parameters: [], zone: "Visage", tolerance: "Bonne", observations: "Aucune réaction signalée." } },
  { id: "S-006", patientId: "P-00248", categoryId: "laser", type: "Contrôle de cicatrice", plannedSessions: 1, pricePerSession: 4000, status: "Terminé", startDate: planningDate, notes: "", sessions: [{ id: "s7", date: planningDate, status: "Réalisée", notes: "Contrôle réalisé." }], planning: { date: planningDate, time: "16:45", room: "Salle Soins 1", nurseId: "n1", doctor: "Dr. Gaya", durationMinutes: 30, instructions: "Documenter l’évolution pour le prochain suivi.", parameters: [], zone: "Zone opérée", tolerance: "Bonne", observations: "Suivi transmis au praticien." } },
  { id: "S-007", patientId: "P-00254", categoryId: "aesthetic", type: "Suivi esthétique", plannedSessions: 2, pricePerSession: 4500, status: "Planifié", startDate: planningDate, notes: "", sessions: [], planning: { date: planningDate, time: "17:30", room: "Salle Soins 1", nurseId: "n2", doctor: "Dr. Gaya", durationMinutes: 30, instructions: "Vérifier les consignes de soin avant la séance.", parameters: [], zone: "Visage", observations: "" } }
 ]
};
