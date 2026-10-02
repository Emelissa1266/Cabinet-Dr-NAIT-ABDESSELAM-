import type { DashboardApi, DashboardAppointmentPreview, DashboardCareSessionPreview, DashboardSurgeryPreview } from "../api-types";

export const dashboardRoleCopy: Record<DashboardApi["role"], { eyebrow: string; title: string; description: string }> = {
  ADMIN: { eyebrow: "Administration", title: "Tableau de bord", description: "Vue d’ensemble de la clinique." },
  DOCTOR: { eyebrow: "Activité médicale", title: "Tableau de bord", description: "Vue d’ensemble de votre activité médicale." },
  NURSE: { eyebrow: "Soins infirmiers", title: "Tableau de bord", description: "Vue d’ensemble de vos soins et rendez-vous." },
  SECRETARY: { eyebrow: "Accueil et administration", title: "Tableau de bord", description: "Vue d’ensemble de l’activité administrative." },
};

export function appointmentDisplay(item: DashboardAppointmentPreview) {
  return {
    title: item.patient_name,
    subtitle: item.appointment_type_name,
    meta: item.primary_staff_name,
  };
}

export function surgeryDisplay(item: DashboardSurgeryPreview) {
  return {
    title: item.patient_name,
    subtitle: item.procedure_name,
  };
}

export function careSessionDisplay(item: DashboardCareSessionPreview) {
  return {
    title: item.patient_name,
    subtitle: item.care_type_name,
    meta: `${item.planned_sessions} séance(s) prévues`,
  };
}

export function dashboardFailureState(message: string) {
  return { data: null, error: message };
}
