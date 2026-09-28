import type { Appointment } from "../types";
export const demoDate = "2026-09-15";
export const mockAppointments: Appointment[] = [
  { id: "a1", patientId: "P-00254", patient: "Sarah Benali", date: demoDate, start: "09:00", end: "10:00", type: "Consultation postopératoire", category: "consultation", status: "En cours", doctor: "Dr. Gaya", room: "Cabinet 01", intervention: "Rhinoplastie", notes: "Contrôle postopératoire. Photographies avant/après disponibles dans le dossier." },
  { id: "a2", patientId: "P-00255", patient: "Lina Haddad", date: demoDate, start: "10:30", end: "11:00", type: "Consultation préopératoire", category: "preop", status: "Confirmé", doctor: "Dr. Gaya", room: "Cabinet 01", notes: "Vérification du bilan et du consentement." },
  { id: "a3", patientId: "P-00248", patient: "Amel Khellil", date: demoDate, start: "14:00", end: "16:00", type: "Rhinoplastie", category: "intervention", status: "Préparée", doctor: "Dr. Gaya", room: "Bloc A", notes: "Dossier préopératoire préparé. Anesthésiste : Dr. Meziani." },
  { id: "a4", patientId: "P-00239", patient: "Karim Benaissa", date: demoDate, start: "16:30", end: "17:00", type: "Contrôle", category: "care", status: "Confirmé", doctor: "Dr. Gaya", room: "Cabinet 01", notes: "Contrôle de cicatrisation." },
  { id: "a5", patientId: "P-00260", patient: "Yasmine Tlemçani", date: "2026-09-16", start: "09:30", end: "10:00", type: "Consultation", category: "consultation", status: "Confirmé", doctor: "Dr. Gaya", room: "Cabinet 01", notes: "Première consultation." },
  { id: "a6", patientId: "P-00215", patient: "Malek Zouaoui", date: "2026-09-16", start: "11:00", end: "12:00", type: "Bilan annuel", category: "consultation", status: "Confirmé", doctor: "Dr. Gaya", room: "Cabinet 01", notes: "Bilan de suivi." },
  { id: "a7", patientId: "P-00254", patient: "Sarah Benali", date: "2026-09-16", start: "11:15", end: "11:30", type: "Pansement", category: "care", status: "Planifié", doctor: "Dr. Gaya", room: "Salle de soins", notes: "Créneau de soins court, en parallèle de la consultation au cabinet." },
  { id: "a8", patientId: "P-00248", patient: "Amel Khellil", date: "2026-09-17", start: "09:00", end: "10:30", type: "Intervention", category: "intervention", status: "Planifié", doctor: "Dr. Gaya", room: "Bloc A", notes: "Exemple de programmation au bloc." },
  { id: "a9", patientId: "P-00255", patient: "Lina Haddad", date: "2026-09-18", start: "10:00", end: "11:30", type: "Soins esthétiques", category: "care", status: "Planifié", doctor: "Dr. Gaya", room: "Salle de soins", notes: "Séance programmée." },
];
