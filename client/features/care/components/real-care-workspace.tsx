"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAgendaStaff } from "@/features/agenda/services/agenda-service";
import type { AgendaStaff } from "@/features/agenda/types";
import { listConsultations } from "@/features/medical/services/consultation-service";
import type { Consultation } from "@/features/medical/types";
import { listPatients } from "@/features/patients/services/patient-service";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import type { CareApi, CareCategoryApi, CareStatus, CareTypeApi, CreateCarePayload, UpdateCarePayload } from "../api-types";
import {
  careErrorMessage,
  carePatient,
  careSessionTime,
  careStatusLabels,
  careType,
  careTypeName,
  dateOnly,
  decimalAmount,
  patientName,
  staffName,
} from "../services/care-display";
import {
  createCare,
  listCareCategories,
  listCares,
  listCareSessions,
  listCareTypes,
  updateCare,
} from "../services/care-api-service";

const statuses: Array<CareStatus | ""> = ["", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function decimalInput(value: string | null | undefined) {
  return value ? value.replace(/,/g, ".") : "0.00";
}

function CarePlanForm({
  care,
  careTypes,
  patients,
  nurses,
  onCancel,
  onSave,
}: {
  care?: CareApi;
  careTypes: CareTypeApi[];
  patients: Patient[];
  nurses: AgendaStaff[];
  onCancel: () => void;
  onSave: (payload: CreateCarePayload | UpdateCarePayload) => Promise<void>;
}) {
  const [patientId, setPatientId] = useState(care?.patient ?? patients[0]?.apiId ?? 0);
  const [careTypeId, setCareTypeId] = useState(care?.care_type ?? careTypes[0]?.id ?? 0);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedType = careTypes.find((item) => item.id === careTypeId);

  useEffect(() => {
    if (!patientId) {
      return;
    }
    let active = true;
    listConsultations({ patient: patientId, ordering: "-consultation_date" })
      .then((response) => {
        if (active) setConsultations(response.results);
      })
      .catch(() => {
        if (active) setConsultations([]);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const plannedSessions = Number(form.get("planned_sessions"));
    const pricePerSession = decimalInput(String(form.get("price_per_session") ?? ""));
    if (!patientId || !careTypeId || !Number.isInteger(plannedSessions) || plannedSessions < 1) {
      setError("Sélectionnez un patient, un type de soin et un nombre de séances valide.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        patient: patientId,
        care_type: careTypeId,
        assigned_nurse: Number(form.get("assigned_nurse")) || null,
        consultation: Number(form.get("consultation")) || null,
        start_date: String(form.get("start_date")),
        end_date: String(form.get("end_date")) || null,
        planned_sessions: plannedSessions,
        price_per_session: pricePerSession,
        status: String(form.get("status")) as CareStatus,
        notes: String(form.get("notes") ?? "").trim(),
      });
    } catch (cause) {
      setError(careErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={ui.form} onSubmit={submit}>
      <label>Patient
        <select value={patientId || ""} onChange={(event) => setPatientId(Number(event.target.value))} required disabled={Boolean(care)}>
          <option value="" disabled>Sélectionner un patient</option>
          {patients.map((patient) => <option key={patient.apiId} value={patient.apiId}>{patient.name}</option>)}
        </select>
      </label>
      <label>Type de soin
        <select value={careTypeId || ""} onChange={(event) => setCareTypeId(Number(event.target.value))} required>
          <option value="" disabled>Sélectionner un type</option>
          {careTypes.map((item) => <option key={item.id} value={item.id}>{item.name}{!item.is_active ? " (inactif)" : ""}</option>)}
        </select>
      </label>
      <label>Consultation liée
        <select name="consultation" defaultValue={care?.consultation ?? ""}>
          <option value="">Aucune consultation liée</option>
          {consultations.map((item) => <option key={item.id} value={item.id}>{dateOnly(item.consultation_date)} · {item.reason || item.consultation_type}</option>)}
        </select>
      </label>
      <label>Infirmier(ère) assigné(e)
        <select name="assigned_nurse" defaultValue={care?.assigned_nurse ?? ""}>
          <option value="">Non assigné</option>
          {nurses.map((nurse) => <option key={nurse.id} value={nurse.id}>{staffName(nurse)}</option>)}
        </select>
      </label>
      <div className={ui.toolbar}>
        <label>Date de début<input name="start_date" type="date" defaultValue={care?.start_date ?? todayKey()} required /></label>
        <label>Date de fin<input name="end_date" type="date" defaultValue={care?.end_date ?? ""} /></label>
      </div>
      <div className={ui.toolbar}>
        <label>Séances prévues<input name="planned_sessions" type="number" min={1} step={1} defaultValue={care?.planned_sessions ?? 1} required /></label>
        <label>Tarif par séance<input name="price_per_session" inputMode="decimal" defaultValue={care?.price_per_session ?? selectedType?.default_price ?? "0.00"} required /></label>
      </div>
      <label>Statut
        <select name="status" defaultValue={care?.status ?? "PLANNED"}>
          {statuses.filter(Boolean).map((status) => <option key={status} value={status}>{careStatusLabels[status as CareStatus]}</option>)}
        </select>
      </label>
      <label>Notes médicales<textarea name="notes" defaultValue={care?.notes ?? ""} maxLength={2000} /></label>
      <p className={ui.muted}>Le total et la progression sont recalculés après enregistrement.</p>
      {error && <p role="alert">{error}</p>}
      <div className={ui.actions}>
        <button className={`${ui.action} ${ui.primary}`} type="submit" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
        <button className={ui.action} type="button" disabled={busy} onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

export function RealCareWorkspace() {
  const [cares, setCares] = useState<CareApi[]>([]);
  const [careCount, setCareCount] = useState(0);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [categories, setCategories] = useState<CareCategoryApi[]>([]);
  const [careTypes, setCareTypes] = useState<CareTypeApi[]>([]);
  const [staff, setStaff] = useState<AgendaStaff[]>([]);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listCareSessions>>["results"]>([]);
  const [selected, setSelected] = useState<CareApi | null>(null);
  const [editing, setEditing] = useState<CareApi | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CareStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyDetail, setBusyDetail] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const nurses = useMemo(() => staff.filter((member) => member.role === "NURSE" && member.is_active), [staff]);

  const loadStatic = useCallback(async () => {
    const [patientPage, categoryPage, typePage, staffList] = await Promise.all([
      listPatients({ ordering: "last_name" }),
      listCareCategories({ ordering: "name" }),
      listCareTypes({ ordering: "name" }),
      listAgendaStaff(),
    ]);
    setPatients(patientPage.results);
    setCategories(categoryPage.results);
    setCareTypes(typePage.results);
    setStaff(staffList);
  }, []);

  const loadCares = useCallback(async () => {
    const response = await listCares({ page, search: query, status, ordering: "-start_date" });
    setCares(response.results);
    setCareCount(response.count);
    setSelected((current) => response.results.find((care) => care.id === current?.id) ?? response.results[0] ?? null);
  }, [page, query, status]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.all([loadStatic(), loadCares()])
        .catch((cause) => {
          if (active) setError(careErrorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadStatic, loadCares]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setBusyDetail(true);
      listCareSessions({ care: selected.id, ordering: "scheduled_at" })
        .then((response) => {
          if (active) setSessions(response.results);
        })
        .catch((cause) => {
          if (active) setError(careErrorMessage(cause));
        })
        .finally(() => {
          if (active) setBusyDetail(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selected]);

  async function saveCare(payload: CreateCarePayload | UpdateCarePayload) {
    const saved = editing === "new" ? await createCare(payload as CreateCarePayload) : await updateCare((editing as CareApi).id, payload);
    setFeedback(`Plan de soin ${careTypeName(careType(saved, careTypes))} enregistré.`);
    setEditing(null);
    await loadCares();
    setSelected(saved);
  }

  const pages = Math.max(1, Math.ceil(careCount / 10));
  const selectedType = selected ? careType(selected, careTypes) : undefined;
  const selectedPatient = selected ? carePatient(selected, patients) : undefined;
  const selectedNurse = staff.find((member) => member.id === selected?.assigned_nurse);

  return (
    <main className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Soins infirmiers</p>
          <h1 className={ui.title}>Plans de soins</h1>
          <p className={ui.description}>Prescription médicale, affectation infirmière, progression et séances réelles.</p>
        </div>
        <div className={ui.actions}>
          <button className={`${ui.action} ${ui.primary}`} onClick={() => setEditing("new")}>Nouveau soin</button>
        </div>
      </header>
      {feedback && <p className={ui.panel} role="status">{feedback}</p>}
      {error && <p className={ui.panel} role="alert">{error}</p>}
      <section className={ui.toolbar}>
        <label className={ui.search}>Recherche<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Patient, note, type de soin..." /></label>
        <select aria-label="Statut du soin" value={status} onChange={(event) => { setStatus(event.target.value as CareStatus | ""); setPage(1); }}>
          {statuses.map((item) => <option key={item || "all"} value={item}>{item ? careStatusLabels[item] : "Tous les statuts"}</option>)}
        </select>
      </section>
      {loading ? <p className={ui.panel} role="status">Chargement des soins...</p> : (
        <div className={ui.toolbar}>
          <section className={ui.tableScroll} aria-label="Plans de soins">
            <table className={ui.table}>
              <thead><tr><th>Patient</th><th>Soin</th><th>Statut</th><th>Progression</th><th>Prix</th></tr></thead>
              <tbody>
                {cares.map((care) => {
                  const patient = carePatient(care, patients);
                  const type = careType(care, careTypes);
                  return (
                    <tr key={care.id} onClick={() => setSelected(care)} aria-selected={selected?.id === care.id}>
                      <td><strong>{patientName(patient)}</strong><small>Début {dateOnly(care.start_date)}</small></td>
                      <td>{careTypeName(type)}<small>{type ? categories.find((category) => category.id === type.category)?.name : ""}</small></td>
                      <td><StatusBadge tone={care.status === "COMPLETED" ? "success" : care.status === "IN_PROGRESS" ? "teal" : "neutral"}>{careStatusLabels[care.status]}</StatusBadge></td>
                      <td>{care.completed_sessions}/{care.planned_sessions}<small>{care.remaining_sessions} restantes · {care.progress_percentage}%</small></td>
                      <td>{decimalAmount(care.total_price)}<small>{decimalAmount(care.price_per_session)} / séance</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!cares.length && <p className={ui.empty}>Aucun plan de soin ne correspond aux filtres.</p>}
            <footer className={ui.footer}>
              <span>{careCount} plans de soins</span>
              <div className={ui.actions}>
                <button className={ui.action} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Précédent</button>
                <span>Page {page} / {pages}</span>
                <button className={ui.action} disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Suivant</button>
              </div>
            </footer>
          </section>
          <aside className={ui.panel}>
            {selected ? (
              <>
                <h2>{careTypeName(selectedType)}</h2>
                <p>{patientName(selectedPatient)} · Infirmier(ère) : {staffName(selectedNurse)}</p>
                <dl>
                  <dt>Début</dt><dd>{dateOnly(selected.start_date)}</dd>
                  <dt>Fin</dt><dd>{dateOnly(selected.end_date)}</dd>
                  <dt>Séances</dt><dd>{selected.completed_sessions}/{selected.planned_sessions} réalisées · {selected.remaining_sessions} restantes</dd>
                  <dt>Progression</dt><dd>{selected.progress_percentage}%</dd>
                  <dt>Total</dt><dd>{decimalAmount(selected.total_price)}</dd>
                  <dt>Consultation</dt><dd>{selected.consultation ? "Consultation liée au plan" : "Non liée"}</dd>
                </dl>
                <p>{selected.notes || "Aucune note médicale renseignée."}</p>
                <div className={ui.actions}>
                  <button className={ui.action} onClick={() => setEditing(selected)}>Modifier</button>
                  {selectedPatient && <Link className={ui.action} href={`/patients/${selectedPatient.patientReference}`}>Dossier patient</Link>}
                </div>
                <h3>Séances</h3>
                {busyDetail ? <p role="status">Chargement des séances...</p> : sessions.length ? (
                  <ul>
                    {sessions.map((session, index) => <li key={session.id}>Séance {index + 1} · {careSessionTime(session)} · {session.status}</li>)}
                  </ul>
                ) : <p>Aucune séance planifiée pour ce soin.</p>}
              </>
            ) : <p>Sélectionnez un plan de soin.</p>}
          </aside>
        </div>
      )}
      <DetailDialog title={editing === "new" ? "Nouveau plan de soin" : "Modifier le plan de soin"} open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && <CarePlanForm care={editing === "new" ? undefined : editing} careTypes={careTypes} patients={patients} nurses={nurses} onCancel={() => setEditing(null)} onSave={saveCare} />}
      </DetailDialog>
    </main>
  );
}
