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
import styles from "@/features/nurse/components/nurse.module.css";
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
  sessionStatusLabels,
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
  const plannedCount = cares.filter((care) => care.status === "PLANNED").length;
  const inProgressCount = cares.filter((care) => care.status === "IN_PROGRESS").length;
  const completedCount = cares.filter((care) => care.status === "COMPLETED").length;

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Soins infirmiers</p>
          <h1>Soins</h1>
          <p>Prescription médicale, affectation infirmière, progression et séances planifiées.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.primary} onClick={() => setEditing("new")}>Nouveau soin</button>
        </div>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
      <div className={styles.toolbar}>
        <select aria-label="Statut du soin" value={status} onChange={(event) => { setStatus(event.target.value as CareStatus | ""); setPage(1); }}>
          {statuses.map((item) => <option key={item || "all"} value={item}>{item ? careStatusLabels[item] : "Tous les statuts"}</option>)}
        </select>
        <input aria-label="Rechercher un soin" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Patient, note, type de soin..." />
      </div>
      <div className={styles.summary} aria-label="Résumé des soins">
        <span>Planifiés <strong>{plannedCount}</strong></span>
        <span>En cours <strong>{inProgressCount}</strong></span>
        <span>Terminés <strong>{completedCount}</strong></span>
      </div>
      {loading ? <p className={styles.panel} role="status">Chargement des soins...</p> : (
        <div className={`${styles.careWorkspace} ${!selected ? styles.careWorkspaceWide : ""}`}>
          <section className={styles.panel} aria-label="Plans de soins">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Plans de soins</p>
                <h2>Suivi prescrit</h2>
              </div>
              <span className={styles.muted}>{careCount} plans de soins</span>
            </div>
            {!cares.length ? <p className={styles.empty}>Aucun plan de soin ne correspond aux filtres.</p> : (
              <div className={styles.careList}>
                {cares.map((care) => {
                  const patient = carePatient(care, patients);
                  const type = careType(care, careTypes);
                  const category = type ? categories.find((item) => item.id === type.category)?.name : "";
                  return (
                    <button key={care.id} className={styles.careCard} aria-pressed={selected?.id === care.id} onClick={() => setSelected(care)}>
                      <span>
                        <strong>{patientName(patient)}</strong>
                        <small>{careTypeName(type)}{category ? ` · ${category}` : ""}</small>
                      </span>
                      <span className={styles.careMeta}>
                        <span>Début {dateOnly(care.start_date)}</span>
                        <StatusBadge tone={care.status === "COMPLETED" ? "success" : care.status === "IN_PROGRESS" ? "teal" : "neutral"}>{careStatusLabels[care.status]}</StatusBadge>
                      </span>
                      <div className={styles.progressLabel}>
                        <span>{care.completed_sessions} / {care.planned_sessions} séances réalisées</span>
                        <strong>{care.remaining_sessions} restantes</strong>
                      </div>
                      <progress value={care.completed_sessions} max={care.planned_sessions} />
                      <small>{care.progress_percentage}% · {decimalAmount(care.total_price)} · {decimalAmount(care.price_per_session)} / séance</small>
                    </button>
                  );
                })}
              </div>
            )}
            <footer className={styles.actions}>
              <button className={styles.secondary} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Précédent</button>
              <span className={styles.muted}>Page {page} / {pages}</span>
              <button className={styles.secondary} disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Suivant</button>
            </footer>
          </section>
          {selected ? (
          <aside className={`${styles.panel} ${styles.execution}`} aria-label="Détail du plan de soin">
            {selected ? (
              <>
                <div className={styles.sectionHeading}>
                  <div>
                    <p className={styles.eyebrow}>Plan de soin</p>
                    <h2>{careTypeName(selectedType)}</h2>
                  </div>
                  <StatusBadge tone={selected.status === "COMPLETED" ? "success" : selected.status === "IN_PROGRESS" ? "teal" : "neutral"}>{careStatusLabels[selected.status]}</StatusBadge>
                </div>
                <div className={styles.identity}>
                  <span>{patientName(selectedPatient).split(" ").map((part) => part[0]).join("").slice(0, 2) || "P"}</span>
                  <div>
                    <strong>{patientName(selectedPatient)}</strong>
                    <p>Infirmier(ère) : {staffName(selectedNurse)}</p>
                    <p>{dateOnly(selected.start_date)} → {dateOnly(selected.end_date)}</p>
                  </div>
                </div>
                <div className={styles.inset}>
                  <div className={styles.progressLabel}>
                    <span>{selected.completed_sessions}/{selected.planned_sessions} séances réalisées</span>
                    <strong>{selected.remaining_sessions} restantes</strong>
                  </div>
                  <progress value={selected.completed_sessions} max={selected.planned_sessions} />
                  <p>{selected.progress_percentage}% · {decimalAmount(selected.total_price)}</p>
                </div>
                <div className={styles.inset}>
                  <small>Instructions médicales</small>
                  <p>{selected.notes || "Aucune note médicale renseignée."}</p>
                </div>
                <div className={styles.inset}>
                  <small>Informations administratives</small>
                  <p>Consultation : {selected.consultation ? "Consultation liée au plan" : "Non liée"}</p>
                  <p>Prix par séance : {decimalAmount(selected.price_per_session)}</p>
                </div>
                <div className={styles.actions}>
                  <button className={styles.secondary} onClick={() => setEditing(selected)}>Modifier</button>
                  {selectedPatient && <Link className={styles.secondary} href={`/patients/${selectedPatient.patientReference}`}>Dossier patient</Link>}
                </div>
                <section>
                  <h3>Séances</h3>
                  {busyDetail ? <p role="status">Chargement des séances...</p> : sessions.length ? (
                    <div className={styles.sessionList}>
                      {sessions.map((session, index) => (
                        <article key={session.id} className={styles.sessionCard}>
                          <strong>Séance {index + 1}</strong>
                          <span>{careSessionTime(session)}</span>
                          <StatusBadge tone={session.status === "COMPLETED" ? "success" : session.status === "IN_PROGRESS" ? "teal" : "neutral"}>{sessionStatusLabels[session.status]}</StatusBadge>
                        </article>
                      ))}
                    </div>
                  ) : <p>Aucune séance planifiée pour ce soin.</p>}
                </section>
              </>
            ) : null}
          </aside>
          ) : null}
        </div>
      )}
      <DetailDialog title={editing === "new" ? "Nouveau plan de soin" : "Modifier le plan de soin"} open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && <CarePlanForm care={editing === "new" ? undefined : editing} careTypes={careTypes} patients={patients} nurses={nurses} onCancel={() => setEditing(null)} onSave={saveCare} />}
      </DetailDialog>
    </main>
  );
}
