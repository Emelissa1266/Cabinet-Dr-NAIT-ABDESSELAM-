"use client";

import { useState } from "react";
import type { Consultation } from "@/features/medical/types";
import type { Patient } from "@/features/patients/types";
import type { Prescription, PrescriptionItemPayload, PrescriptionPayload, PrescriptionStatus } from "../types";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";

interface MedicationRow extends Required<Pick<PrescriptionItemPayload, "medication_name" | "dosage" | "frequency">> {
  id: string;
  route: string;
  duration: string;
  quantity: string;
  instructions: string;
  start_date: string;
  end_date: string;
}

const statusOptions: { value: PrescriptionStatus; label: string }[] = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Terminée" },
  { value: "CANCELLED", label: "Annulée" },
];

const newMedication = (id: string): MedicationRow => ({
  id,
  medication_name: "",
  dosage: "",
  frequency: "",
  route: "",
  duration: "",
  quantity: "",
  instructions: "",
  start_date: "",
  end_date: "",
});

function medicationFromPrescription(prescription: Prescription): MedicationRow[] {
  return prescription.items.map((item) => ({
    id: String(item.id),
    medication_name: item.medication_name,
    dosage: item.dosage,
    frequency: item.frequency,
    route: item.route,
    duration: item.duration,
    quantity: item.quantity === null ? "" : String(item.quantity),
    instructions: item.instructions,
    start_date: item.start_date ?? "",
    end_date: item.end_date ?? "",
  }));
}

function nowForInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function inputDateTime(value?: string | null) {
  if (!value) return nowForInput();
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

function medicationPayload(row: MedicationRow): PrescriptionItemPayload {
  return {
    medication_name: row.medication_name.trim(),
    dosage: row.dosage.trim(),
    frequency: row.frequency.trim(),
    route: row.route.trim(),
    duration: row.duration.trim(),
    quantity: row.quantity ? Number(row.quantity) : null,
    instructions: row.instructions.trim(),
    start_date: row.start_date || null,
    end_date: row.end_date || null,
  };
}

export function PrescriptionEditor({
  patients,
  consultations = [],
  defaultPatientId,
  lockedPatient = false,
  prescription,
  onSave,
}: {
  patients: Patient[];
  consultations?: Consultation[];
  defaultPatientId?: number;
  lockedPatient?: boolean;
  prescription?: Prescription | null;
  onSave: (payload: PrescriptionPayload) => Promise<void>;
}) {
  const [medications, setMedications] = useState<MedicationRow[]>(prescription?.items.length ? medicationFromPrescription(prescription) : [newMedication("first")]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [patientId, setPatientId] = useState(defaultPatientId ? String(defaultPatientId) : prescription ? String(prescription.patient) : "");

  const availableConsultations = consultations.filter((consultation) => !patientId || consultation.patient === Number(patientId));

  function update(id: string, key: keyof Omit<MedicationRow, "id">, value: string) {
    setMedications((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }

  return (
    <form
      className={ui.form}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (!patientId) {
          setError("Sélectionnez un patient.");
          return;
        }
        if (!medications.length || medications.some((row) => !row.medication_name.trim() || !row.dosage.trim() || !row.frequency.trim())) {
          setError("Renseignez le médicament, la posologie et la fréquence.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          const consultation = String(form.get("consultation") ?? "");
          await onSave({
            patient: Number(patientId),
            consultation: consultation ? Number(consultation) : null,
            prescribed_at: toIsoDateTime(String(form.get("prescribed_at"))),
            status: String(form.get("status")) as PrescriptionStatus,
            general_instructions: String(form.get("general_instructions") ?? "").trim(),
            notes: String(form.get("notes") ?? "").trim(),
            items: medications.map(medicationPayload),
          });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer l’ordonnance. Réessayez.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Patient
        <select name="patient" required value={patientId} disabled={lockedPatient} onChange={(event) => setPatientId(event.target.value)}>
          <option value="" disabled>Sélectionner un patient</option>
          {patients.map((patient) => <option key={patient.apiId} value={patient.apiId}>{patient.name}</option>)}
        </select>
      </label>
      <label>
        Consultation liée
        <select name="consultation" defaultValue={prescription?.consultation ?? ""}>
          <option value="">Aucune consultation liée</option>
          {availableConsultations.map((consultation) => (
            <option key={consultation.id} value={consultation.id}>
              {new Date(consultation.consultation_date).toLocaleDateString("fr-DZ")} · {consultation.reason}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.twoColumns}>
        <label>
          Date de prescription
          <input type="datetime-local" name="prescribed_at" required defaultValue={inputDateTime(prescription?.prescribed_at)} />
        </label>
        <label>
          Statut
        <select name="status" defaultValue={prescription?.status ?? "ACTIVE"}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </label>
      </div>
      {medications.map((medication, index) => (
        <fieldset className={styles.fieldset} key={medication.id}>
          <legend>Médicament {index + 1}</legend>
          <label>Médicament<input required maxLength={180} value={medication.medication_name} onChange={(event) => update(medication.id, "medication_name", event.target.value)} /></label>
          <div className={styles.twoColumns}>
            <label>Dosage<input required maxLength={120} value={medication.dosage} onChange={(event) => update(medication.id, "dosage", event.target.value)} /></label>
            <label>Fréquence<input required maxLength={120} value={medication.frequency} onChange={(event) => update(medication.id, "frequency", event.target.value)} /></label>
          </div>
          <div className={styles.twoColumns}>
            <label>Voie<input maxLength={120} value={medication.route} onChange={(event) => update(medication.id, "route", event.target.value)} /></label>
            <label>Durée<input maxLength={120} value={medication.duration} onChange={(event) => update(medication.id, "duration", event.target.value)} /></label>
          </div>
          <div className={styles.twoColumns}>
            <label>Quantité<input type="number" min="0" value={medication.quantity} onChange={(event) => update(medication.id, "quantity", event.target.value)} /></label>
            <label>Début<input type="date" value={medication.start_date} onChange={(event) => update(medication.id, "start_date", event.target.value)} /></label>
          </div>
          <label>Fin<input type="date" value={medication.end_date} onChange={(event) => update(medication.id, "end_date", event.target.value)} /></label>
          <label>Instructions<input maxLength={500} value={medication.instructions} onChange={(event) => update(medication.id, "instructions", event.target.value)} /></label>
          <button className={ui.action} type="button" disabled={medications.length === 1} onClick={() => setMedications((current) => current.filter((item) => item.id !== medication.id))} aria-label={`Retirer le médicament ${index + 1}`}>Retirer</button>
        </fieldset>
      ))}
      <button className={ui.action} type="button" disabled={medications.length >= 20} onClick={() => setMedications((current) => [...current, newMedication(crypto.randomUUID())])}>Ajouter un médicament</button>
      <label>Instructions générales<textarea name="general_instructions" maxLength={2000} defaultValue={prescription?.general_instructions ?? ""} /></label>
      <label>Notes internes<textarea name="notes" maxLength={2000} defaultValue={prescription?.notes ?? ""} /></label>
      {error && <p role="alert">{error}</p>}
      <button className={`${ui.action} ${ui.primary}`} type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer l’ordonnance"}</button>
    </form>
  );
}
