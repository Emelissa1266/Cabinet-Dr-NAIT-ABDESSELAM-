"use client";

import { useMemo, useState } from "react";
import { listAgendaStaff } from "@/features/agenda/services/agenda-service";
import type { AppointmentType } from "@/features/agenda/types";
import type { ClinicClosureApi, StaffTimeOffApi, StaffWorkingHoursApi } from "../api-types";
import { AdminGuard } from "./admin-guard";
import { AdminConfigPage, type ConfigField } from "./admin-config-page";

type Tab = "types" | "hours" | "timeoff" | "closures";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "types", label: "Types" },
  { id: "hours", label: "Horaires" },
  { id: "timeoff", label: "Absences" },
  { id: "closures", label: "Fermetures" },
];

const staffOptions = async () => {
  const staff = await listAgendaStaff();
  return { staff: staff.map((item) => ({ value: item.id, label: item.display_name || item.username })) };
};

export function AdminAgendaPage() {
  const [tab, setTab] = useState<Tab>("types");
  const appointmentFields: ConfigField[] = useMemo(() => [
    { name: "name", label: "Nom", required: true },
    { name: "code", label: "Code", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "default_duration_minutes", label: "Duree par defaut", type: "number", required: true },
    { name: "category", label: "Categorie", type: "select", options: [
      { value: "CONSULTATION", label: "Consultation" },
      { value: "FOLLOW_UP", label: "Suivi" },
      { value: "SURGERY", label: "Intervention" },
      { value: "NURSING_CARE", label: "Soin infirmier" },
      { value: "PREOPERATIVE", label: "Preoperatoire" },
      { value: "POSTOPERATIVE", label: "Postoperatoire" },
      { value: "OTHER", label: "Autre" },
    ] },
    { name: "requires_doctor", label: "Requiert un medecin", type: "checkbox" },
    { name: "requires_nurse", label: "Requiert un infirmier", type: "checkbox" },
    { name: "is_active", label: "Actif", type: "checkbox" },
  ], []);
  const workingHoursFields: ConfigField[] = useMemo(() => [
    { name: "staff", label: "Personnel", type: "select", required: true },
    { name: "weekday", label: "Jour", type: "select", options: [
      { value: 0, label: "Lundi" },
      { value: 1, label: "Mardi" },
      { value: 2, label: "Mercredi" },
      { value: 3, label: "Jeudi" },
      { value: 4, label: "Vendredi" },
      { value: 5, label: "Samedi" },
      { value: 6, label: "Dimanche" },
    ], required: true },
    { name: "start_time", label: "Debut", type: "time", required: true },
    { name: "end_time", label: "Fin", type: "time", required: true },
    { name: "is_active", label: "Actif", type: "checkbox" },
  ], []);
  const timeOffFields: ConfigField[] = useMemo(() => [
    { name: "staff", label: "Personnel", type: "select", required: true },
    { name: "start_at", label: "Debut", type: "datetime", required: true },
    { name: "end_at", label: "Fin", type: "datetime", required: true },
    { name: "reason", label: "Motif", type: "select", options: [
      { value: "LEAVE", label: "Conge" },
      { value: "SICK", label: "Maladie" },
      { value: "TRAINING", label: "Formation" },
      { value: "PERSONAL", label: "Personnel" },
      { value: "OTHER", label: "Autre" },
    ] },
    { name: "notes", label: "Notes", type: "textarea" },
  ], []);
  const closureFields: ConfigField[] = useMemo(() => [
    { name: "start_at", label: "Debut", type: "datetime", required: true },
    { name: "end_at", label: "Fin", type: "datetime", required: true },
    { name: "reason", label: "Motif", required: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ], []);

  return (
    <AdminGuard>
      <nav className="admin-tabs" aria-label="Configuration agenda">
        {tabs.map((item) => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>
      {tab === "types" && (
        <AdminConfigPage<AppointmentType>
          eyebrow="Administration agenda"
          title="Types de rendez-vous"
          description="Catalogue utilise par la creation de rendez-vous et la disponibilite."
          path="appointment-types"
          fields={appointmentFields}
          activeField="is_active"
          emptyMessage="Aucun type de rendez-vous configure."
          columns={[{ key: "name", label: "Nom" }, { key: "code", label: "Code" }, { key: "category", label: "Categorie" }, { key: "default_duration_minutes", label: "Duree" }]}
        />
      )}
      {tab === "hours" && (
        <AdminConfigPage<StaffWorkingHoursApi>
          eyebrow="Administration agenda"
          title="Horaires du personnel"
          description="Plages de travail consommees par le moteur de disponibilite."
          path="staff-working-hours"
          ordering="staff"
          fields={workingHoursFields}
          activeField="is_active"
          dependencies={staffOptions}
          emptyMessage="Aucun horaire de personnel configure."
          columns={[{ key: "staff", label: "Personnel" }, { key: "weekday", label: "Jour" }, { key: "start_time", label: "Debut" }, { key: "end_time", label: "Fin" }]}
        />
      )}
      {tab === "timeoff" && (
        <AdminConfigPage<StaffTimeOffApi>
          eyebrow="Administration agenda"
          title="Indisponibilites"
          description="Absences et indisponibilites prises en compte par la disponibilite."
          path="staff-time-off"
          ordering="start_at"
          fields={timeOffFields}
          dependencies={staffOptions}
          emptyMessage="Aucune indisponibilite configuree."
          columns={[{ key: "staff", label: "Personnel" }, { key: "reason", label: "Motif" }, { key: "start_at", label: "Debut" }, { key: "end_at", label: "Fin" }]}
        />
      )}
      {tab === "closures" && (
        <AdminConfigPage<ClinicClosureApi>
          eyebrow="Administration agenda"
          title="Fermetures cabinet"
          description="Fermetures globales du cabinet consommees par la disponibilite."
          path="clinic-closures"
          ordering="start_at"
          fields={closureFields}
          emptyMessage="Aucune fermeture du cabinet configuree."
          columns={[{ key: "reason", label: "Motif" }, { key: "start_at", label: "Debut" }, { key: "end_at", label: "Fin" }]}
        />
      )}
    </AdminGuard>
  );
}
