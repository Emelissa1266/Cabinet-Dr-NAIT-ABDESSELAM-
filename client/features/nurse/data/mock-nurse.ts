import type { NurseData, NursingRecord } from "../types";
export const nurseProfile = { id: "demo-nurse", name: "Nadia Benali", title: "Infirmière D.E." };
const date = "2026-09-21";
const emptyRecord: NursingRecord = { performedTreatment: "", zone: "", device: "", wavelength: "", fluence: "", spotSize: "", frequency: "", tolerance: "", reaction: "", observations: "", incidents: "", notes: "" };
const completedRecord = { ...emptyRecord, performedTreatment: "Soin prescrit réalisé", zone: "Zone prescrite", tolerance: "Bonne" as const, reaction: "Aucune" as const, observations: "Suivi transmis au praticien. Données fictives." };
export const mockNurse: NurseData = {
    date, nurse: nurseProfile,
    patients: [
        { id: "P-00254", name: "Sarah Benali", age: 32, initials: "SB", phone: "+213 550 12 34 56", allergies: "Pénicilline — réaction cutanée documentée.", phototype: "III", precautions: "Vérifier les contre-indications et les consignes du praticien avant la séance.", relevantHistory: "Suivi postopératoire de rhinoplastie.", intervention: { name: "Rhinoplastie ultrasonique", date: "2026-09-03", doctor: "Dr. Gaya", followUp: "Contrôle chirurgical programmé le 28 septembre." }, vitals: [{ label: "Tension artérielle", value: "118 / 74 mmHg" }, { label: "Pouls", value: "68 bpm" }, { label: "Température", value: "36,7 °C" }, { label: "Douleur", value: "1 / 10" }] },
        { id: "P-00255", name: "Lina Haddad", age: 28, initials: "LH", phone: "+213 661 45 67 89", allergies: "Aucune allergie documentée dans la démonstration.", phototype: "III", precautions: "Vérifier l’état cutané avant application du protocole.", relevantHistory: "Programme laser prescrit par le praticien." },
        { id: "P-00248", name: "Amel Khellil", age: 41, initials: "AK", phone: "+213 770 98 76 54", allergies: "Non renseignées — à vérifier.", phototype: "II", precautions: "Assistance au praticien selon ses consignes.", relevantHistory: "Suivi esthétique postopératoire." },
        { id: "P-00215", name: "Malek Zouaoui", age: 45, initials: "MZ", phone: "+213 551 77 88 99", allergies: "Aucune allergie documentée.", phototype: "III", precautions: "Contrôle de tolérance cutanée.", relevantHistory: "Programme de soin visage." },
        { id: "P-00260", name: "Yasmine Tlemçani", age: 29, initials: "YT", phone: "+213 662 33 44 55", allergies: "Aucune allergie documentée.", phototype: "III", precautions: "Surveillance de la cicatrisation.", relevantHistory: "Contrôle postopératoire." }
    ],
    programs: [
        { id: "NP-01", patientId: "P-00254", name: "Pansement postopératoire & retrait attelle", category: "Pansement", plannedSessions: 1, priorCompleted: 0, doctor: "Dr. Gaya", protocol: "Contrôle de cicatrisation et soin local selon les instructions du dossier. Protocole fictif de démonstration.", zone: "Zone nasale" },
        { id: "NP-02", patientId: "P-00254", name: "Laser — Jambes complètes", category: "Laser", plannedSessions: 6, priorCompleted: 1, doctor: "Dr. Gaya", protocol: "Effectuer la séance sur les zones prescrites. Vérifier les précautions du dossier et suivre les paramètres validés par le praticien. Protocole fictif.", zone: "Jambes complètes (face antérieure et postérieure)", laser: { type: "Alexandrite", device: "Candela GentleMax Pro", wavelength: "755 nm", fluence: "16.5", spotSize: "18", frequency: "2" } },
        { id: "NP-03", patientId: "P-00255", name: "Laser — Demi-jambes & aisselles", category: "Laser", plannedSessions: 6, priorCompleted: 1, doctor: "Dr. Meziane", protocol: "Consulter le protocole personnalisé et vérifier la tolérance avant la séance. Protocole fictif.", zone: "Demi-jambes et aisselles", laser: { type: "Alexandrite", device: "Candela GentleMax Pro", wavelength: "755 nm", fluence: "14", spotSize: "18", frequency: "2" } },
        { id: "NP-04", patientId: "P-00248", name: "Injection — Assistance au praticien", category: "Injection", plannedSessions: 1, priorCompleted: 0, doctor: "Dr. Gaya", protocol: "Préparer le matériel et assister le praticien. Le geste médical est réalisé par le médecin. Protocole fictif.", zone: "Visage" },
        { id: "NP-05", patientId: "P-00215", name: "Soin visage éclat HydraPure", category: "Soin visage", plannedSessions: 4, priorCompleted: 2, doctor: "Dr. Gaya", protocol: "Soin cutané selon les consignes personnalisées du praticien. Protocole fictif.", zone: "Visage" },
        { id: "NP-06", patientId: "P-00260", name: "Contrôle cicatrice & réfection pansement", category: "Pansement", plannedSessions: 1, priorCompleted: 0, doctor: "Dr. Gaya", protocol: "Surveillance de cicatrisation et transmission au médecin. Protocole fictif.", zone: "Zone cicatricielle" }
    ],
    sessions: [
        { id: "NS-01", programId: "NP-01", nurseId: nurseProfile.id, date, start: "09:30", end: "10:00", room: "Cabine Soins 1", status: "Terminé", startedAt: "2026-09-21T08:30:00Z", completedAt: "2026-09-21T08:50:00Z", validatedAt: "2026-09-21T08:50:00Z", record: { ...completedRecord } },
        { id: "NS-02", programId: "NP-02", nurseId: nurseProfile.id, date, start: "10:00", end: "10:45", room: "Salle Laser 2", status: "Planifié", record: { ...emptyRecord } },
        { id: "NS-03", programId: "NP-03", nurseId: nurseProfile.id, date, start: "11:30", end: "12:15", room: "Salle Laser 2", status: "Planifié", record: { ...emptyRecord } },
        { id: "NS-04", programId: "NP-04", nurseId: nurseProfile.id, date, start: "14:00", end: "14:45", room: "Cabinet 1", status: "En cours", startedAt: "2026-09-21T13:00:00Z", record: { ...emptyRecord, performedTreatment: "Assistance au praticien", zone: "Visage" } },
        { id: "NS-05", programId: "NP-05", nurseId: nurseProfile.id, date, start: "15:30", end: "16:15", room: "Cabine Dermato", status: "Planifié", record: { ...emptyRecord } },
        { id: "NS-06", programId: "NP-06", nurseId: nurseProfile.id, date, start: "16:45", end: "17:15", room: "Salle Soins 1", status: "Terminé", startedAt: "2026-09-21T15:45:00Z", completedAt: "2026-09-21T16:15:00Z", validatedAt: "2026-09-21T16:15:00Z", record: { ...completedRecord } },
        { id: "NS-07", programId: "NP-02", nurseId: nurseProfile.id, date: "2026-09-25", start: "10:00", end: "10:45", room: "Salle Laser 2", status: "Planifié", record: { ...emptyRecord } },
        { id: "NS-08", programId: "NP-03", nurseId: nurseProfile.id, date: "2026-09-25", start: "10:15", end: "11:00", room: "Salle Laser 3", status: "Planifié", record: { ...emptyRecord } }
    ],
    photos: [
        { id: "NPH-01", patientId: "P-00254", programId: "NP-01", pairId: "pair-sarah", phase: "Avant", date: "2026-08-13", zone: "Face", sessionNumber: 1, category: "Suivi postopératoire", notes: "Cliché de démonstration, vue de face.", image: { src: "/images/sarah-before.png", width: 229, height: 128, alt: "Photo clinique de démonstration avant intervention" } },
        { id: "NPH-02", patientId: "P-00254", programId: "NP-01", pairId: "pair-sarah", phase: "Après", date: "2026-09-09", zone: "Profil", sessionNumber: 1, category: "Suivi postopératoire", notes: "Cliché de démonstration, vue de profil. Les vues diffèrent : aucune mesure comparative n’est proposée.", image: { src: "/images/sarah-after.png", width: 235, height: 128, alt: "Photo clinique de démonstration après intervention" } }
    ]
};
