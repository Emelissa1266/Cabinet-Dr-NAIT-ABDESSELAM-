"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { useAuth } from "@/features/auth/components/auth-provider";
import { PatientFinancialSection } from "@/features/billing/components/patient-financial-section";
import { PatientCareSection } from "@/features/care/components/patient-care-section";
import { PatientDocumentsSection } from "@/features/documents/components/patient-documents-section";
import { PatientPhotosSection } from "@/features/documents/components/patient-photos-section";
import { PatientSurgerySection } from "@/features/interventions/components/patient-surgery-section";
import { PatientPhase9ESections } from "@/features/medical/components/patient-phase-9e-sections";
import { MedicalAlertsPanel, MedicalAlertsSummary } from "./medical-alerts-panel";
import { PatientAppointmentsSection } from "./patient-appointments-section";
import type { Patient } from "../types";
import { deletePatient, getPatient, updatePatient } from "../services/patient-service";
import { fieldErrors, patientErrorMessage, type FieldErrors } from "../services/patient-errors";
import { PatientForm } from "./patient-form";
import ui from "@/components/ui/clinical.module.css";
import styles from "./patient-detail.module.css";

const tabs = ["Vue générale", "Médical", "Rendez-vous", "Interventions", "Ordonnances", "Soins", "Photos", "Documents", "Paiements"];

function formatDate(value: string | null) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function PatientDetail({ id, basePath = "/patients" }: { id: string; basePath?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Vue générale");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrorState, setFieldErrorState] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const canDelete = user?.role === "ADMIN" || user?.role === "DOCTOR";
  const canReadCare = user?.role === "ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE";
  const canReadSurgery = user?.role === "ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE" || user?.role === "SECRETARY";
  const canReadBilling = user?.role === "ADMIN" || user?.role === "SECRETARY" || user?.role === "DOCTOR" || user?.role === "NURSE";
  const canReadDocuments = user?.role === "ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE" || user?.role === "SECRETARY";
  const canReadPhotos = user?.role === "ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE";
  const canReadMedicalAlerts = user?.role === "ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE";
  const show = (name: string) => tab === "Vue générale" || tab === name;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPatient(await getPatient(id));
    } catch (cause) {
      setPatient(null);
      setError(patientErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(payload: Parameters<typeof updatePatient>[1]) {
    if (!patient) return;
    setBusy(true);
    setFeedback("");
    setFieldErrorState({});
    try {
      setPatient(await updatePatient(patient.apiId, payload));
      setEditing(false);
      setFeedback("Dossier patient mis à jour.");
    } catch (cause) {
      setFieldErrorState(fieldErrors(cause));
      setFeedback(patientErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!patient) return;
    setBusy(true);
    setFeedback("");
    try {
      await deletePatient(patient.apiId);
      router.replace(basePath);
    } catch (cause) {
      setFeedback(patientErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className={ui.page}><p className={ui.panel} role="status">Chargement du dossier patient…</p></main>;
  if (error || !patient) return <main className={ui.page}><Breadcrumb items={[{ label: "Patients", href: basePath }, { label: "Dossier patient" }]} /><section className={ui.panel}><h1>Dossier patient</h1><p role="alert">{error || "Patient introuvable."}</p><Link className={ui.action} href={basePath}>Retour aux patients</Link></section></main>;

  const medical = patient.medicalInformation;
  return (
    <div>
      <Breadcrumb items={[{ label: "Patients", href: basePath }, { label: patient.name }]} />
      {feedback && <p className={ui.panel} role="status">{feedback}</p>}
      <header className={styles.header}>
        <div className={styles.identity}><span className={ui.avatar}>{patient.initials}</span><div><div className={styles.name}><h1>{patient.name}</h1><StatusBadge tone={patient.isActive ? "teal" : "neutral"}>{patient.status}</StatusBadge></div><p>{patient.patientReference}{patient.age !== null ? ` · ${patient.age} ans` : ""} · Né(e) le {formatDate(patient.dateOfBirth)}</p></div><div className={ui.actions}><Link href="/agenda" className={ui.action}>Rendez-vous</Link><button className={`${ui.action} ${ui.primary}`} onClick={() => { setFieldErrorState({}); setFeedback(""); setEditing(true); }}>Modifier</button>{canDelete && <button className={ui.action} onClick={() => setDeleting(true)}>Supprimer</button>}</div></div>
        {canReadMedicalAlerts && <MedicalAlertsSummary patientId={patient.apiId} compact />}
        <div className={styles.tabs} role="tablist" aria-label="Sections du dossier patient">{tabs.map((name, index) => <button id={`patient-tab-${index}`} key={name} role="tab" aria-selected={tab === name} aria-controls="patient-section" tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next]); document.getElementById(`patient-tab-${next}`)?.focus(); } }} onClick={() => setTab(name)}>{name}</button>)}</div>
      </header>
      <div id="patient-section" role="tabpanel" aria-labelledby={`patient-tab-${tabs.indexOf(tab)}`} className={styles.columns}>
        <div className={styles.stack}>
          {show("Médical") && <section className={ui.panel}><h2>Informations essentielles</h2><dl className={styles.info}><dt>Téléphone</dt><dd>{patient.phone || "Non renseigné"}</dd><dt>Email personnel</dt><dd>{patient.email || "Non renseigné"}</dd><dt>Date de naissance</dt><dd>{formatDate(patient.dateOfBirth)}</dd><dt>Ville</dt><dd>{patient.city || "Non renseignée"}</dd><dt>Profession</dt><dd>{patient.profession || "Non renseignée"}</dd><dt>Contact d’urgence</dt><dd>{patient.emergencyContact || "Non renseigné"} {patient.emergencyPhone}</dd></dl></section>}
          {show("Médical") && (canReadMedicalAlerts ? <MedicalAlertsPanel patient={patient} /> : <section className={ui.panel}><h2>Alertes médicales</h2><p>Informations médicales non disponibles pour votre rôle.</p></section>)}
          {show("Photos") && canReadPhotos && <PatientPhotosSection patient={patient} />}
          {tab === "Photos" && !canReadPhotos && <section className={ui.panel}><h2>Photothèque clinique</h2><p>Les photos cliniques ne sont pas disponibles pour votre rôle.</p></section>}
        </div>
        <div className={styles.stack}>
          {show("Rendez-vous") && <PatientAppointmentsSection patient={patient} basePath={basePath} />}
          {show("Interventions") && canReadSurgery && <PatientSurgerySection patient={patient} />}
          {tab === "Interventions" && !canReadSurgery && <section className={ui.panel}><h2>Interventions</h2><p>Les interventions ne sont pas disponibles pour votre rôle.</p></section>}
          {show("Médical") && <section className={ui.panel}><h2>Notes & dossier</h2><div className={styles.inset}><h3>Notes administratives</h3><p>{patient.notes || "Aucune note administrative."}</p></div>{medical?.clinical_notes.length ? <div className={styles.inset}><h3>Notes cliniques</h3>{medical.clinical_notes.map((note) => <p key={note.id}>{dateTime(note.created_at)} — {note.note}</p>)}</div> : <div className={styles.inset}><h3>Notes cliniques</h3><p>{medical ? "Aucune note clinique active." : "Non disponible pour votre rôle."}</p></div>}</section>}
          {show("Médical") && <PatientPhase9ESections patient={patient} mode="medical" />}
          {tab === "Vue générale" && <section className={ui.panel}><h2>Activité récente</h2><p>Dossier créé le {dateTime(patient.createdAt)}.</p><p>Dernière mise à jour le {dateTime(patient.updatedAt)}.</p></section>}
          {tab === "Ordonnances" && <PatientPhase9ESections patient={patient} mode="prescriptions" />}
          {show("Soins") && canReadCare && <PatientCareSection patient={patient} />}
          {tab === "Soins" && !canReadCare && <section className={ui.panel}><h2>Soins</h2><p>Les soins cliniques ne sont pas disponibles pour votre rôle.</p></section>}
          {show("Paiements") && canReadBilling && <PatientFinancialSection patient={patient} />}
          {tab === "Paiements" && !canReadBilling && <section className={ui.panel}><h2>Paiements</h2><p>La synthèse financière n’est pas disponible pour votre rôle.</p></section>}
          {show("Documents") && canReadDocuments && <PatientDocumentsSection patient={patient} />}
          {tab === "Documents" && !canReadDocuments && <section className={ui.panel}><h2>Documents</h2><p>Les documents ne sont pas disponibles pour votre rôle.</p></section>}
        </div>
      </div>
      <DetailDialog title="Modifier patient" open={editing} onClose={() => setEditing(false)}>
        <PatientForm patient={patient} busy={busy} errors={fieldErrorState} onCancel={() => setEditing(false)} onSubmit={save} />
      </DetailDialog>
      <DetailDialog title="Supprimer le patient" open={deleting} onClose={() => setDeleting(false)}>
        <p>Confirmez la suppression du dossier de {patient.name}. Cette action peut être refusée si des contraintes médicales existent.</p>
        <div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} disabled={busy} onClick={confirmDelete}>{busy ? "Suppression…" : "Confirmer"}</button><button className={ui.action} disabled={busy} onClick={() => setDeleting(false)}>Annuler</button></div>
      </DetailDialog>
    </div>
  );
}
