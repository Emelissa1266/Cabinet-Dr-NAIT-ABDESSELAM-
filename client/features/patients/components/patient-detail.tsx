"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { useAuth } from "@/features/auth/components/auth-provider";
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
        <div className={styles.tabs} role="tablist" aria-label="Sections du dossier patient">{tabs.map((name, index) => <button id={`patient-tab-${index}`} key={name} role="tab" aria-selected={tab === name} aria-controls="patient-section" tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next]); document.getElementById(`patient-tab-${next}`)?.focus(); } }} onClick={() => setTab(name)}>{name}</button>)}</div>
      </header>
      <div id="patient-section" role="tabpanel" aria-labelledby={`patient-tab-${tabs.indexOf(tab)}`} className={styles.columns}>
        <div className={styles.stack}>
          {show("Médical") && <section className={ui.panel}><h2>Informations essentielles</h2><dl className={styles.info}><dt>Téléphone</dt><dd>{patient.phone || "Non renseigné"}</dd><dt>Email personnel</dt><dd>{patient.email || "Non renseigné"}</dd><dt>Date de naissance</dt><dd>{formatDate(patient.dateOfBirth)}</dd><dt>Ville</dt><dd>{patient.city || "Non renseignée"}</dd><dt>Profession</dt><dd>{patient.profession || "Non renseignée"}</dd><dt>Contact d’urgence</dt><dd>{patient.emergencyContact || "Non renseigné"} {patient.emergencyPhone}</dd></dl></section>}
          {show("Médical") && <section className={ui.panel}><h2>Alertes médicales</h2>{medical ? <><div className={styles.warning}><h3>Allergies</h3>{medical.allergies.length ? medical.allergies.map((item) => <p key={item.id}>{item.title}{item.severity ? ` · ${item.severity}` : ""} — {item.description || "Sans description"}</p>) : <p>Aucune allergie active renseignée.</p>}</div><div className={styles.inset}><h3>Antécédents</h3>{medical.medical_history.length ? medical.medical_history.map((item) => <p key={item.id}>{item.title} — {item.description || "Sans description"}</p>) : <p>Aucun antécédent actif renseigné.</p>}</div></> : <p>Informations médicales non disponibles pour votre rôle.</p>}</section>}
          {show("Photos") && <section className={ui.panel}><h2>Photothèque clinique</h2><p>Les photos cliniques privées seront raccordées dans la phase Documents / Photothèque.</p></section>}
        </div>
        <div className={styles.stack}>
          {show("Rendez-vous") && <section className={`${ui.panel} ${styles.next}`}><p className={ui.eyebrow}>Rendez-vous</p><h2>À raccorder en Phase 9D</h2><p>Les rendez-vous ne sont pas chargés depuis le module Patients pendant cette phase.</p></section>}
          {show("Interventions") && <section className={ui.panel}><h2>Interventions</h2><p>Les chirurgies et interventions seront raccordées pendant la phase Surgery.</p></section>}
          {show("Médical") && <section className={ui.panel}><h2>Notes & dossier</h2><div className={styles.inset}><h3>Notes administratives</h3><p>{patient.notes || "Aucune note administrative."}</p></div>{medical?.clinical_notes.length ? <div className={styles.inset}><h3>Notes cliniques</h3>{medical.clinical_notes.map((note) => <p key={note.id}>{dateTime(note.created_at)} — {note.note}</p>)}</div> : <div className={styles.inset}><h3>Notes cliniques</h3><p>{medical ? "Aucune note clinique active." : "Non disponible pour votre rôle."}</p></div>}</section>}
          {tab === "Vue générale" && <section className={ui.panel}><h2>Activité récente</h2><p>Dossier créé le {dateTime(patient.createdAt)}.</p><p>Dernière mise à jour le {dateTime(patient.updatedAt)}.</p></section>}
          {["Ordonnances", "Soins", "Documents", "Paiements"].includes(tab) && <section className={ui.panel}><h2>{tab}</h2><p>Ce module sera raccordé lors de sa phase d’intégration dédiée.</p>{tab !== "Documents" && <Link className={ui.action} href={tab === "Ordonnances" ? "/prescriptions" : tab === "Soins" ? "/care" : "/billing"}>Ouvrir le module</Link>}</section>}
        </div>
      </div>
      <DetailDialog title="Modifier patient" open={editing} onClose={() => setEditing(false)}>
        <PatientForm patient={patient} busy={busy} errors={fieldErrorState} onCancel={() => setEditing(false)} onSubmit={save} />
      </DetailDialog>
      <DetailDialog title="Supprimer le patient" open={deleting} onClose={() => setDeleting(false)}>
        <p>Confirmez la suppression du dossier {patient.patientReference}. Le backend reste l’autorité et peut refuser cette action.</p>
        <div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} disabled={busy} onClick={confirmDelete}>{busy ? "Suppression…" : "Confirmer"}</button><button className={ui.action} disabled={busy} onClick={() => setDeleting(false)}>Annuler</button></div>
      </DetailDialog>
    </div>
  );
}
