import type { DoctorDashboardData } from "../types";

// Fictional design fixtures, never real patient records.
export const mockDashboard: DoctorDashboardData = {
  date: "2026-09-15",
  doctorName: "Dr. Gaya",
  room: "Cabinet consultation 01",
  summary: { appointments: 12, interventions: 2, followUps: 4 },
  appointments: [
    { id: "appointment-1", patientId: "CL-4412", patientName: "Sarah Benali", startTime: "09:00", endTime: "09:30", type: "Consultation", description: "Première visite — Rhinoplastie ultraso", status: "waiting-room" },
    { id: "appointment-2", patientId: "CL-3890", patientName: "Lina Haddad", startTime: "10:30", endTime: "11:15", type: "Préopératoire", description: "Bilan & simulation 3D — Blépharoplastie sup", status: "confirmed" },
    { id: "appointment-3", patientId: "CL-2184", patientName: "Amel K.", startTime: "14:00", endTime: "16:00", type: "Intervention", description: "Rhinoplastie structurelle de préservation", status: "prepared", room: "Bloc A" },
    { id: "appointment-4", patientId: "CL-5091", patientName: "Karim B.", startTime: "16:00", endTime: "16:30", type: "Contrôle", description: "J+15 Ablation de l’attelle thermoformée & clichés", status: "confirmed" },
    { id: "appointment-5", patientId: "CL-6228", patientName: "Yasmine T.", startTime: "17:30", endTime: "18:00", type: "Consultation de suivi", description: "Acide hyaluronique lèvres & définition", status: "pending" },
  ],
  priorities: [
    { id: "follow-up", title: "2 patients à suivre", subtitle: "Revue des constantes J+1", description: "Mme Haddad (œdème malaire modéré), M. Mansouri (drainage vérifié).", footer: "Protocole infirmier validé", action: "Consulter", tone: "teal", icon: "follow-up" },
    { id: "document", title: "1 document manquant", subtitle: "Bilan hémostase pré-opératoire", description: "Dossier de Mme Khellil pour intervention prévue jeudi. Relance secrétaire effectuée.", footer: "Laboratoire Pasteur", action: "Relancer", tone: "warning", icon: "missing-document" },
    { id: "surgery", title: "1 intervention demain", subtitle: "Lifting cervico-facial profond & lipofilling", description: "Bloc A — Équipe anesthésiste Dr. Zerrouk. Check-list matériel prête.", footer: "Durée estimée : 3h30", action: "Fiche bloc", tone: "neutral", icon: "scheduled-procedure", time: "08:30" },
  ],
};
