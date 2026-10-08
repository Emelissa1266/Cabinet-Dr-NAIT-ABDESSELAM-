"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import { listConsultations } from "@/features/medical/services/consultation-service";
import { medicalErrorMessage } from "@/features/medical/services/medical-errors";
import type { Consultation } from "@/features/medical/types";
import { listPatients } from "@/features/patients/services/patient-service";
import { MedicalAlertsSummary } from "@/features/patients/components/medical-alerts-panel";
import type { Patient } from "@/features/patients/types";
import type { Prescription, PrescriptionPayload, PrescriptionStatus } from "../types";
import { prescriptionService } from "../services/prescription-service";
import { PrescriptionEditor } from "./prescription-editor";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";

const statusLabels: Record<PrescriptionStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

const statusTones: Record<PrescriptionStatus, StatusTone> = {
  DRAFT: "neutral",
  ACTIVE: "teal",
  CANCELLED: "warning",
  COMPLETED: "success",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function PrescriptionWorkspace() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PrescriptionStatus | "">("");
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const patientByApiId = useMemo(() => new Map(patients.map((patient) => [patient.apiId, patient])), [patients]);
  const consultationById = useMemo(() => new Map(consultations.map((consultation) => [consultation.id, consultation])), [consultations]);
  const patientName = useCallback((id: number) => patientByApiId.get(id)?.name ?? "Patient", [patientByApiId]);
  const patientPath = useCallback((id: number) => patientByApiId.get(id)?.patientReference ?? "", [patientByApiId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [patientPage, prescriptionPage, consultationPage] = await Promise.all([
        listPatients({ ordering: "last_name" }),
        prescriptionService.list({ ordering: "-prescribed_at" }),
        listConsultations({ ordering: "-consultation_date" }),
      ]);
      setPatients(patientPage.results);
      setPrescriptions(prescriptionPage.results);
      setConsultations(consultationPage.results);
    } catch (cause) {
      setError(medicalErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = prescriptions.filter((prescription) => {
    const text = [
      patientName(prescription.patient),
      prescription.id,
      prescription.general_instructions,
      prescription.notes,
      prescription.items.map((item) => item.medication_name).join(" "),
    ].join(" ").toLocaleLowerCase("fr");
    return (!status || prescription.status === status) && text.includes(query.toLocaleLowerCase("fr"));
  });

  async function save(payload: PrescriptionPayload) {
    const result = await prescriptionService.create(payload);
    setPrescriptions((current) => [result, ...current]);
    setCreating(false);
    setMessage("Ordonnance enregistrée dans le dossier médical.");
  }

  async function update(prescription: Prescription, payload: PrescriptionPayload) {
    const result = await prescriptionService.update(prescription.id, payload);
    setPrescriptions((current) => current.map((item) => item.id === result.id ? result : item));
    setSelected(result);
    setEditing(null);
    setMessage("Ordonnance mise à jour.");
  }

  if (loading) return <main className={ui.page}><p className={ui.panel} role="status">Chargement des ordonnances…</p></main>;

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Prescriptions médicales</p>
          <h1 className={ui.title}>Ordonnances</h1>
          <p className={ui.description}>Historique et préparation des prescriptions du cabinet.</p>
        </div>
        <button className={`${ui.action} ${ui.primary}`} onClick={() => { setMessage(""); setCreating(true); }}>Nouvelle ordonnance</button>
      </header>
      {error && <p className={styles.feedback} role="alert">{error}</p>}
      {message && <p className={styles.feedback} role="status">{message}</p>}
      <div className={ui.toolbar}>
        <label className={ui.search}>
          <span className="sr-only">Rechercher une ordonnance</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Patient, référence ou médicament…" />
        </label>
        <div className={ui.tabs} aria-label="Filtrer les ordonnances">
          {(["", "DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const).map((value) => (
            <button key={value || "all"} className={ui.tab} aria-pressed={status === value} onClick={() => setStatus(value)}>
              {value ? statusLabels[value] : "Toutes"}
            </button>
          ))}
        </div>
      </div>
      <div className={ui.tableScroll}>
        <table className={ui.table}>
          <thead><tr><th>Date / référence</th><th>Patient</th><th>Prescription</th><th>Consultation</th><th>Statut</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.map((prescription) => (
              <tr key={prescription.id}>
                <td>{formatDateTime(prescription.prescribed_at)}</td>
                <td><strong>{patientName(prescription.patient)}</strong></td>
                <td>{prescription.items.length} médicament(s)<span className={styles.small}>{prescription.items[0]?.medication_name ?? prescription.general_instructions}</span></td>
                <td>{prescription.consultation ? consultationById.get(prescription.consultation)?.reason ?? "Consultation liée" : "Non liée"}</td>
                <td><StatusBadge tone={statusTones[prescription.status]}>{statusLabels[prescription.status]}</StatusBadge></td>
                <td><button className={styles.link} onClick={() => setSelected(prescription)} aria-label={`Voir l’ordonnance ${prescription.id}`}>Consulter</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className={ui.empty}>Aucune ordonnance ne correspond à votre recherche.</p>}
      </div>
      <DetailDialog title="Nouvelle ordonnance" open={creating} onClose={() => setCreating(false)}>
        {creating && <PrescriptionEditor patients={patients} consultations={consultations} onSave={save} />}
      </DetailDialog>
      <DetailDialog title="Détail de l’ordonnance" open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <h3>{patientName(selected.patient)}</h3>
            <p>{formatDateTime(selected.prescribed_at)} · {user?.displayName || user?.username || "Praticien"}</p>
            <StatusBadge tone={statusTones[selected.status]}>{statusLabels[selected.status]}</StatusBadge>
            <MedicalAlertsSummary patientId={selected.patient} />
            <section className={styles.section}>
              <h3>Prescription</h3>
              <ol className={styles.list}>
                {selected.items.map((item) => (
                  <li key={item.id}>
                    <strong>{item.medication_name}</strong>
                    <p>{item.dosage}</p>
                    <p>{item.frequency}{item.route ? ` · ${item.route}` : ""}{item.duration ? ` · ${item.duration}` : ""}</p>
                    {item.quantity !== null && <small>Quantité: {item.quantity}</small>}
                    {item.instructions && <small>{item.instructions}</small>}
                  </li>
                ))}
              </ol>
            </section>
            <section className={styles.section}>
              <h3>Instructions générales</h3>
              <p>{selected.general_instructions || selected.notes || "Aucune instruction complémentaire."}</p>
            </section>
            <div className={ui.actions}>
              {patientPath(selected.patient)
                ? <Link className={ui.action} href={`/patients/${patientPath(selected.patient)}`}>Dossier patient</Link>
                : <button className={ui.action} disabled>Dossier patient</button>}
              <button className={ui.action} onClick={() => setEditing(selected)}>Modifier</button>
              <button className={ui.action} disabled title="Impression indisponible pour le moment">Imprimer</button>
              <button className={ui.action} disabled title="Export PDF indisponible pour le moment">Exporter PDF</button>
            </div>
          </>
        )}
      </DetailDialog>
      <DetailDialog title="Modifier l’ordonnance" open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && <PrescriptionEditor patients={patients} consultations={consultations} prescription={editing} onSave={(payload) => update(editing, payload)} />}
      </DetailDialog>
    </div>
  );
}
