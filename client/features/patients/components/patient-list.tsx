"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/shared/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { useAuth } from "@/features/auth/components/auth-provider";
import type { Patient, PatientGender, PatientListParams, PaginatedResponse } from "../types";
import { createPatient, deletePatient, listPatients } from "../services/patient-service";
import { fieldErrors, patientErrorMessage, type FieldErrors } from "../services/patient-errors";
import { PatientForm } from "./patient-form";
import styles from "@/components/ui/clinical.module.css";

const genderOptions: { value: PatientGender | ""; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "FEMALE", label: "Femmes" },
  { value: "MALE", label: "Hommes" },
  { value: "OTHER", label: "Autre" },
  { value: "UNKNOWN", label: "Non renseigné" },
];

function formatDate(value: string | null) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function exportList(patients: Patient[]) {
  const text = ["Patient;Référence;Téléphone;Ville;Statut", ...patients.map((p) => [p.name, p.patientReference, p.phone, p.city, p.status].join(";"))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "patients.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

const pageSize = 20;

export function PatientList({ basePath = "/patients", initialQuery = "", initialCreate = false }: { basePath?: string; initialQuery?: string; initialCreate?: boolean }) {
  const { user } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [gender, setGender] = useState<PatientGender | "">("");
  const [isActive, setIsActive] = useState<boolean | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<Patient> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newOpen, setNewOpen] = useState(initialCreate);
  const [busy, setBusy] = useState(false);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const canDelete = user?.role === "ADMIN" || user?.role === "DOCTOR";

  const params = useMemo<PatientListParams>(() => ({ page, search: debouncedQuery, gender, isActive, ordering: "last_name,first_name" }), [page, debouncedQuery, gender, isActive]);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await listPatients(params));
    } catch (cause) {
      setData(null);
      setError(patientErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPatients();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPatients]);

  async function create(payload: Parameters<typeof createPatient>[0]) {
    setBusy(true);
    setFormErrors({});
    setFeedback("");
    try {
      const patient = await createPatient(payload);
      setNewOpen(false);
      setFeedback(`Dossier ${patient.patientReference} créé.`);
      setQuery(patient.patientReference);
      setDebouncedQuery(patient.patientReference);
      setPage(1);
      await loadPatients();
    } catch (cause) {
      setFormErrors(fieldErrors(cause));
      setFeedback(patientErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setFeedback("");
    try {
      await deletePatient(deleteTarget.apiId);
      setDeleteTarget(null);
      setFeedback(`Dossier ${deleteTarget.patientReference} supprimé.`);
      await loadPatients();
    } catch (cause) {
      setFeedback(patientErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const patients = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><p className={styles.eyebrow}>Registre médical</p><h1 className={styles.title}>Patients</h1><p className={styles.description}>{data ? `${data.count} dossiers backend` : "Dossiers patients"}</p></div>
        <div className={styles.actions}><button className={styles.action} disabled={!patients.length} onClick={() => exportList(patients)}><Icon name="export" size={13} />Exporter</button><button className={`${styles.action} ${styles.primary}`} onClick={() => { setFormErrors({}); setFeedback(""); setNewOpen(true); }}><Icon name="add" size={13} />Nouveau patient</button></div>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.search}><Icon name="search" /><span className="sr-only">Rechercher un patient</span><input placeholder="Rechercher (nom, référence, téléphone, email)..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className={styles.tabs} aria-label="Filtrer les patients">
          <select aria-label="Genre" value={gender} onChange={(event) => { setGender(event.target.value as PatientGender | ""); setPage(1); }}>{genderOptions.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}</select>
          <select aria-label="Statut actif" value={isActive === "" ? "" : String(isActive)} onChange={(event) => { setIsActive(event.target.value === "" ? "" : event.target.value === "true"); setPage(1); }}><option value="">Tous les statuts</option><option value="true">Actifs</option><option value="false">Inactifs</option></select>
        </div>
      </div>
      {feedback && <p className={styles.panel} role="status">{feedback}</p>}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr><th>Patient</th><th>Téléphone</th><th>Naissance</th><th>Ville</th><th>Statut</th><th>Action</th></tr></thead>
          <tbody>{!loading && patients.map((patient) => <tr key={patient.id}><td><Link href={`${basePath}/${patient.id}`} className={styles.identity}><span className={styles.avatar}>{patient.initials}</span><span><strong>{patient.name}</strong><small>{patient.patientReference}{patient.age !== null ? ` · ${patient.age} ans` : ""}</small></span></Link></td><td>{patient.phone || "Non renseigné"}</td><td className={styles.muted}>{formatDate(patient.dateOfBirth)}</td><td>{patient.city || "Non renseignée"}</td><td><StatusBadge tone={patient.isActive ? "success" : "neutral"}>{patient.status}</StatusBadge></td><td><Link href={`${basePath}/${patient.id}`} aria-label={`Ouvrir le dossier de ${patient.name}`}><Icon name="patient-folder" /></Link>{canDelete && <button className={styles.action} onClick={() => setDeleteTarget(patient)}>Supprimer</button>}</td></tr>)}</tbody>
        </table>
        {loading && <p className={styles.empty}>Chargement des patients…</p>}
        {!loading && error && <p className={styles.empty} role="alert">{error}</p>}
        {!loading && !error && patients.length === 0 && <p className={styles.empty}>Aucun patient ne correspond à votre recherche.</p>}
        <div className={styles.footer}><span>{patients.length} sur {data?.count ?? 0} patients</span><span>Page {page} sur {totalPages}</span><div className={styles.actions}><button className={styles.action} disabled={!data?.previous || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Précédent</button><button className={styles.action} disabled={!data?.next || loading} onClick={() => setPage((current) => current + 1)}>Suivant</button></div></div>
      </div>
      <DetailDialog title="Nouveau patient" open={newOpen} onClose={() => setNewOpen(false)}>
        <PatientForm busy={busy} errors={formErrors} onCancel={() => setNewOpen(false)} onSubmit={create} />
      </DetailDialog>
      <DetailDialog title="Supprimer le patient" open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <p>Confirmez la suppression du dossier {deleteTarget?.patientReference}. Le backend refusera l’opération si votre rôle ou les contraintes médicales ne l’autorisent pas.</p>
        <div className={styles.actions}><button className={`${styles.action} ${styles.primary}`} disabled={busy} onClick={confirmDelete}>{busy ? "Suppression…" : "Confirmer"}</button><button className={styles.action} disabled={busy} onClick={() => setDeleteTarget(null)}>Annuler</button></div>
      </DetailDialog>
    </div>
  );
}
