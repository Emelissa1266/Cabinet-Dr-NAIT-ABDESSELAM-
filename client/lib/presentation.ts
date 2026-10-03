import type { Role } from "@/features/auth/types";

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrateur",
  DOCTOR: "Chirurgien plasticien",
  NURSE: "Personnel soignant",
  SECRETARY: "Secrétariat",
};

export const statusLabels: Record<string, string> = {
  ACTIVE: "Actif",
  ARCHIVED: "Archivé",
  DRAFT: "Brouillon",
  PLANNED: "Planifié",
  SCHEDULED: "Planifié",
  CONFIRMED: "Confirmé",
  CHECKED_IN: "Arrivé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  NO_SHOW: "Absent",
  PENDING: "En attente",
  NEEDS_REVIEW: "À revoir",
  READY: "Prêt",
  NOT_READY: "Non prêt",
  NOT_APPLICABLE: "Non applicable",
  SATISFIED: "Satisfait",
  BLOCKED: "Bloqué",
  WAIVED: "Dispensé",
  CLEARED: "Validé",
  UNKNOWN: "Non renseigné",
  CONFIRMED_FASTING: "Confirmé",
  NOT_FASTED: "Non à jeun",
  NOT_REQUIRED: "Non requis",
  NEGATIVE: "Négatif",
  POSITIVE: "Positif",
  ISSUED: "Émise",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
};

export const auditActionLabels: Record<string, string> = {
  ADMIN_USER_CREATED: "Utilisateur créé",
  ADMIN_USER_UPDATED: "Utilisateur modifié",
  ADMIN_USER_ACTIVATION_CHANGED: "Activation utilisateur modifiée",
  APPOINTMENT_CREATED: "Rendez-vous créé",
  APPOINTMENT_CONFIRMED: "Rendez-vous confirmé",
  APPOINTMENT_CHECKED_IN: "Patient arrivé",
  APPOINTMENT_STARTED: "Rendez-vous commencé",
  APPOINTMENT_COMPLETED: "Rendez-vous terminé",
  APPOINTMENT_NO_SHOW: "Absence enregistrée",
  APPOINTMENT_CANCELLED: "Rendez-vous annulé",
  APPOINTMENT_RESCHEDULED: "Rendez-vous déplacé",
  APPOINTMENT_TYPE_CREATED: "Type de rendez-vous créé",
  BILLABLE_SERVICE_CREATED: "Prestation facturable créée",
  BILLABLE_SERVICE_UPDATED: "Prestation facturable modifiée",
  CARE_CATEGORY_CREATED: "Catégorie de soin créée",
  CARE_TYPE_CREATED: "Type de soin créé",
  CARE_CREATED: "Soin créé",
  CARE_SESSION_STARTED: "Séance de soin démarrée",
  CARE_SESSION_COMPLETED: "Séance de soin terminée",
  CARE_PARAMETER_DEFINITION_CREATED: "Paramètre de soin créé",
  CLINICAL_MEASUREMENT_RECORDED: "Mesure clinique enregistrée",
  CLINICAL_PHOTO_UPLOADED: "Photo clinique importée",
  CLINICAL_PHOTO_DOWNLOADED: "Photo clinique téléchargée",
  CLINICAL_PHOTO_VIEWED: "Photo clinique consultée",
  CLINICAL_PHOTO_ARCHIVED: "Photo clinique archivée",
  CLINICAL_PHOTO_COMPARISON_CREATED: "Comparaison de photos créée",
  CONSULTATION_CREATED: "Consultation créée",
  CONSULTATION_COMPLETED: "Consultation terminée",
  DOCUMENT_CATEGORY_CREATED: "Catégorie de document créée",
  DOCUMENT_CATEGORY_UPDATED: "Catégorie de document modifiée",
  DOCUMENT_UPLOADED: "Document importé",
  DOCUMENT_DOWNLOADED: "Document téléchargé",
  DOCUMENT_VIEWED: "Document consulté",
  DOCUMENT_ARCHIVED: "Document archivé",
  INTERVENTION_TYPE_CREATED: "Type d’intervention créé",
  INVOICE_CREATED: "Facture créée",
  INVOICE_ITEM_ADDED: "Ligne de facture ajoutée",
  INVOICE_ITEM_CHANGED: "Ligne de facture modifiée",
  INVOICE_ISSUED: "Facture émise",
  INVOICE_CANCELLED: "Facture annulée",
  INVOICE_DISCOUNT_CHANGED: "Remise de facture modifiée",
  NOTIFICATION_MARKED_READ: "Notification marquée comme lue",
  NOTIFICATION_MARKED_UNREAD: "Notification marquée comme non lue",
  NOTIFICATIONS_MARKED_ALL_READ: "Notifications marquées comme lues",
  PATIENT_CREATED: "Patient créé",
  PATIENT_UPDATED: "Patient modifié",
  PATIENT_DELETED: "Patient supprimé",
  PAYMENT_CREATED: "Paiement créé",
  PAYMENT_ALLOCATED: "Paiement affecté",
  PAYMENT_COMPLETED: "Paiement validé",
  PAYMENT_CANCELLED: "Paiement annulé",
  PRESCRIPTION_CREATED: "Ordonnance créée",
  PRESCRIPTION_UPDATED: "Ordonnance modifiée",
  RECEIPT_CREATED: "Reçu créé",
  SURGERY_CREATED: "Intervention créée",
  SURGERY_PLANNED: "Intervention planifiée",
  SURGERY_PREOP_STARTED: "Préopératoire démarré",
  SURGERY_READY_APPROVED: "Intervention prête validée",
  SURGERY_STARTED: "Intervention démarrée",
  SURGERY_COMPLETED: "Intervention terminée",
  SURGERY_CANCELLED: "Intervention annulée",
  PREOP_CHECKLIST_ITEM_CREATED: "Élément de checklist créé",
  WORKING_HOURS_CHANGED: "Horaires de travail modifiés",
};

export const entityLabels: Record<string, string> = {
  AnesthesiaRecord: "Dossier d’anesthésie",
  Appointment: "Rendez-vous",
  AppointmentType: "Type de rendez-vous",
  BillableService: "Prestation facturable",
  Care: "Soin",
  CareCategory: "Catégorie de soin",
  CareParameterDefinition: "Paramètre de soin",
  CareSession: "Séance de soin",
  CareType: "Type de soin",
  ClinicalMeasurement: "Mesure clinique",
  ClinicalPhoto: "Photo clinique",
  ClinicalPhotoComparison: "Comparaison de photos",
  ClinicalPhotoSet: "Série de photos",
  Consultation: "Consultation",
  Document: "Document",
  DocumentCategory: "Catégorie de document",
  InterventionType: "Type d’intervention",
  Invoice: "Facture",
  InvoiceItem: "Ligne de facture",
  Notification: "Notification",
  Patient: "Patient",
  Payment: "Paiement",
  PaymentAllocation: "Affectation de paiement",
  Prescription: "Ordonnance",
  Receipt: "Reçu",
  Surgery: "Intervention",
  User: "Utilisateur",
};

export function roleLabel(role: Role) {
  return roleLabels[role] ?? "Utilisateur";
}

export function statusLabel(value: string | null | undefined) {
  if (!value) return "Non renseigné";
  return statusLabels[value] ?? "Statut non renseigné";
}

export function auditActionLabel(action: string | null | undefined) {
  if (!action) return "Activité système";
  return auditActionLabels[action] ?? "Activité système";
}

export function entityLabel(entityType: string | null | undefined) {
  if (!entityType) return "Élément";
  return entityLabels[entityType] ?? "Élément";
}

export function personName(value: string | null | undefined, fallback = "Système") {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name || /^undefined undefined$/i.test(name) || /^null null$/i.test(name)) return fallback;
  if (/^string string$/i.test(name)) return "Utilisateur";
  return name;
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function safeErrorMessage(fallback: string) {
  return fallback;
}
