"use client";

import { useState, type FormEvent } from "react";
import type { CreatePatientPayload, Patient, PatientGender } from "../types";
import { patientGenders } from "../types";
import type { FieldErrors } from "../services/patient-errors";
import styles from "@/components/ui/clinical.module.css";

const genderLabels: Record<PatientGender, string> = {
  FEMALE: "Femme",
  MALE: "Homme",
  OTHER: "Autre",
  UNKNOWN: "Non renseigné",
};

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function optionalDate(raw: string) {
  return raw || null;
}

export function patientToPayload(form: FormData): CreatePatientPayload {
  return {
    first_name: value(form, "first_name"),
    last_name: value(form, "last_name"),
    date_of_birth: optionalDate(value(form, "date_of_birth")),
    gender: value(form, "gender") as PatientGender,
    phone: value(form, "phone"),
    email: value(form, "email"),
    address: value(form, "address"),
    city: value(form, "city"),
    emergency_contact: value(form, "emergency_contact"),
    emergency_phone: value(form, "emergency_phone"),
    profession: value(form, "profession"),
    notes: value(form, "notes"),
    is_active: form.get("is_active") === "on",
  };
}

export function PatientForm({
  patient,
  busy,
  errors,
  onCancel,
  onSubmit,
}: {
  patient?: Patient;
  busy: boolean;
  errors: FieldErrors;
  onCancel: () => void;
  onSubmit: (payload: CreatePatientPayload) => Promise<void>;
}) {
  const [active, setActive] = useState(patient?.isActive ?? true);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    await onSubmit(patientToPayload(new FormData(event.currentTarget)));
  }
  const input = (name: keyof CreatePatientPayload, label: string, type = "text", required = false) => (
    <label>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={String(patient?.[formKey(name)] ?? "")}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
      {errors[name] && <span id={`${name}-error`} className={styles.muted}>{errors[name]}</span>}
    </label>
  );
  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h3>État civil</h3>
      {patient && <label>Référence patient<input readOnly value={patient.patientReference} /></label>}
      {input("last_name", "Nom *", "text", true)}
      {input("first_name", "Prénom *", "text", true)}
      {input("date_of_birth", "Date de naissance", "date")}
      <label>
        Genre
        <select name="gender" defaultValue={patient?.gender ?? "UNKNOWN"}>
          {patientGenders.map((gender) => <option key={gender} value={gender}>{genderLabels[gender]}</option>)}
        </select>
        {errors.gender && <span className={styles.muted}>{errors.gender}</span>}
      </label>
      <h3>Coordonnées</h3>
      {input("phone", "Téléphone", "tel")}
      {input("email", "E-mail", "email")}
      {input("address", "Adresse")}
      {input("city", "Ville")}
      <h3>Administration</h3>
      {input("profession", "Profession")}
      {input("emergency_contact", "Contact d’urgence")}
      {input("emergency_phone", "Téléphone d’urgence", "tel")}
      <label>Notes<textarea name="notes" defaultValue={patient?.notes ?? ""} /></label>
      {errors.notes && <span className={styles.muted}>{errors.notes}</span>}
      <label><input type="checkbox" name="is_active" checked={active} onChange={(event) => setActive(event.target.checked)} /> Dossier actif</label>
      <div className={styles.actions}>
        <button type="submit" disabled={busy} className={`${styles.action} ${styles.primary}`}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        <button type="button" disabled={busy} className={styles.action} onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function formKey(name: keyof CreatePatientPayload): keyof Patient {
  const map: Record<keyof CreatePatientPayload, keyof Patient> = {
    first_name: "firstName",
    last_name: "lastName",
    date_of_birth: "dateOfBirth",
    gender: "gender",
    phone: "phone",
    email: "email",
    address: "address",
    city: "city",
    emergency_contact: "emergencyContact",
    emergency_phone: "emergencyPhone",
    profession: "profession",
    notes: "notes",
    is_active: "isActive",
  };
  return map[name];
}
