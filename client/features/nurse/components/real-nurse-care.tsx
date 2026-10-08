"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  createCare,
  createCareSession,
  createCareObservation,
  createCareSessionMaterial,
  createCareSessionParameter,
  createClinicalMeasurement,
  completeCareSession,
  listCares,
  listCareObservations,
  listCareParameterDefinitions,
  listCareSessionMaterials,
  listCareSessionParameters,
  listCareSessions,
  listCareTypes,
  listClinicalMeasurements,
  startCareSession,
  updateCare,
  updateCareSessionParameter,
} from "@/features/care/services/care-api-service";
import {
  careErrorMessage,
  careSessionTime,
  careStatusLabels,
  dateTime,
  decimalAmount,
  measurementTypeLabels,
  sessionStatusLabels,
} from "@/features/care/services/care-display";
import type {
  CareApi,
  CareObservationApi,
  CareParameterDefinitionApi,
  CareSessionApi,
  CareSessionMaterialApi,
  CareSessionParameterApi,
  CareSessionStatus,
  CareTypeApi,
  ClinicalMeasurementApi,
  ClinicalMeasurementType,
} from "@/features/care/api-types";
import { listPatients } from "@/features/patients/services/patient-service";
import { MedicalAlertsSummary } from "@/features/patients/components/medical-alerts-panel";
import type { Patient } from "@/features/patients/types";
import { eligibleSessionCares, mergeById, mergeCreatedSession, replaceById } from "../services/nurse-care-state";
import ui from "@/components/ui/clinical.module.css";
import styles from "./nurse.module.css";

const sessionFilters: Array<CareSessionStatus | "TODAY" | "ALL"> = ["TODAY", "PLANNED", "IN_PROGRESS", "COMPLETED", "ALL"];
const measurementTypes = Object.keys(measurementTypeLabels) as ClinicalMeasurementType[];
type CareFormMode = "create" | "edit" | null;

function dateKey(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function localDateTimeInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function toIsoFromLocal(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? new Date(raw).toISOString() : "";
}

function sessionFilterLabel(value: CareSessionStatus | "TODAY" | "ALL") {
  if (value === "TODAY") return "Aujourd’hui";
  if (value === "ALL") return "Toutes";
  return sessionStatusLabels[value];
}

function parameterInputType(definition: CareParameterDefinitionApi) {
  if (definition.data_type === "NUMBER") return "number";
  if (definition.data_type === "DATE") return "date";
  return "text";
}

export function RealNurseCare({ initialSession }: { initialSession?: string }) {
  const [sessions, setSessions] = useState<CareSessionApi[]>([]);
  const [cares, setCares] = useState<CareApi[]>([]);
  const [careTypes, setCareTypes] = useState<CareTypeApi[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialSession && /^\d+$/.test(initialSession) ? Number(initialSession) : null);
  const [filter, setFilter] = useState<CareSessionStatus | "TODAY" | "ALL">(initialSession ? "ALL" : "TODAY");
  const [query, setQuery] = useState("");
  const [careForNewSession, setCareForNewSession] = useState<number | "">("");
  const [newCareType, setNewCareType] = useState<number | "">("");
  const [newCarePatient, setNewCarePatient] = useState<number | "">("");
  const [careFormMode, setCareFormMode] = useState<CareFormMode>(null);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [observations, setObservations] = useState<CareObservationApi[]>([]);
  const [measurements, setMeasurements] = useState<ClinicalMeasurementApi[]>([]);
  const [materials, setMaterials] = useState<CareSessionMaterialApi[]>([]);
  const [definitions, setDefinitions] = useState<CareParameterDefinitionApi[]>([]);
  const [parameters, setParameters] = useState<CareSessionParameterApi[]>([]);
  const [observationText, setObservationText] = useState("");
  const [parameterValues, setParameterValues] = useState<Record<number, string>>({});
  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null;

  const careById = useMemo(() => new Map(cares.map((care) => [care.id, care])), [cares]);
  const activeCares = useMemo(() => eligibleSessionCares(cares), [cares]);
  const selectedCareForManagement = activeCares.find((care) => care.id === Number(careForNewSession)) ?? activeCares[0] ?? null;
  const plannedSessions = useMemo(() => sessions.filter((session) => session.status === "PLANNED").length, [sessions]);
  const inProgressSessions = useMemo(() => sessions.filter((session) => session.status === "IN_PROGRESS").length, [sessions]);
  const completedToday = useMemo(() => sessions.filter((session) => session.status === "COMPLETED" && dateKey(session.completed_at) === todayKey()).length, [sessions]);
  const visibleSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return sessions
      .filter((session) => {
        if (filter === "TODAY") return dateKey(session.scheduled_at) === todayKey();
        if (filter === "ALL") return true;
        return session.status === filter;
      })
      .filter((session) => {
        if (!normalizedQuery) return true;
        const care = careById.get(session.care);
        return `${session.patient_name} ${session.care_type_name} ${care?.care_category_name ?? ""} ${session.notes}`.toLocaleLowerCase("fr").includes(normalizedQuery);
      });
  }, [careById, filter, query, sessions]);

  const loadSessions = useCallback(async () => {
    const [sessionPage, carePage, typePage, patientPage] = await Promise.all([
      listCareSessions({ ordering: "scheduled_at" }),
      listCares({ ordering: "-start_date" }),
      listCareTypes({ is_active: true, ordering: "name" }),
      listPatients({ isActive: true, ordering: "last_name" }),
    ]);
    const careById = new Map(carePage.results.map((care) => [care.id, care]));
    setSessions(sessionPage.results);
    setCares([...careById.values()]);
    setCareTypes(typePage.results);
    setPatients(patientPage.results);
    setSelectedId((current) => sessionPage.results.find((session) => session.id === current)?.id ?? sessionPage.results[0]?.id ?? null);
    setCareForNewSession((current) => current || carePage.results.find((care) => !["COMPLETED", "CANCELLED"].includes(care.status) && care.remaining_sessions > 0)?.id || "");
    setNewCareType((current) => current || typePage.results[0]?.id || "");
    setNewCarePatient((current) => current || patientPage.results[0]?.apiId || "");
  }, []);

  const loadSelectedRecords = useCallback(async () => {
    if (!selected) {
      setObservations([]);
      setMeasurements([]);
      setMaterials([]);
      setDefinitions([]);
      setParameters([]);
      setParameterValues({});
      return;
    }
    const care = careById.get(selected.care);
    const [observationPage, measurementPage, materialPage, parameterPage, definitionPage] = await Promise.all([
      listCareObservations({ care_session: selected.id, ordering: "-created_at" }),
      listClinicalMeasurements({ care_session: selected.id, ordering: "-recorded_at" }),
      listCareSessionMaterials({ care_session: selected.id, ordering: "-created_at" }),
      listCareSessionParameters({ care_session: selected.id, ordering: "parameter_definition" }),
      care ? listCareParameterDefinitions({ care_type: care.care_type, active: true, ordering: "key" }) : Promise.resolve({ count: 0, next: null, previous: null, results: [] }),
    ]);
    setObservations(observationPage.results);
    setMeasurements(measurementPage.results);
    setMaterials(materialPage.results);
    setDefinitions(definitionPage.results);
    setParameters(parameterPage.results);
    setParameterValues(Object.fromEntries(parameterPage.results.map((parameter) => [parameter.parameter_definition, parameter.value])));
  }, [careById, selected]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      loadSessions()
        .catch((cause) => {
          if (active) setLoadError(careErrorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadSessions]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      loadSelectedRecords().catch((cause) => {
        if (active) setLoadError(careErrorMessage(cause));
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadSelectedRecords]);

  async function runMutation<T>(
    action: () => Promise<T>,
    success: string,
    options: {
      onSuccess?: (result: T) => void;
      refreshFailure?: string;
    } = {},
  ) {
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      const result = await action();
      options.onSuccess?.(result);
      setMessage(success);
      try {
        await loadSessions();
        await loadSelectedRecords();
        setLoadError("");
      } catch (cause) {
        setLoadError(options.refreshFailure ?? careErrorMessage(cause));
      }
    } catch (cause) {
      setActionError(careErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitObservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !observationText.trim()) return;
    await runMutation(async () => {
      await createCareObservation({ care_session: selected.id, observation: observationText.trim() });
      setObservationText("");
    }, "Observation enregistrée.");
  }

  async function submitNewCare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!newCarePatient || !newCareType) return;
    await runMutation(async () => {
      return createCare({
        patient: Number(newCarePatient),
        care_type: Number(newCareType),
        start_date: String(form.get("start_date") || todayKey()),
        end_date: String(form.get("end_date") || "") || null,
        planned_sessions: Number(form.get("planned_sessions") || 1),
        price_per_session: String(form.get("price_per_session") || "0.00"),
        notes: String(form.get("notes") ?? "").trim(),
      });
    }, "Soin créé.", {
      onSuccess: (care) => {
        setCares((current) => mergeById(current, care));
        setCareForNewSession(care.id);
        setCareFormMode(null);
        formElement.reset();
      },
      refreshFailure: "Le soin a été créé, mais la liste n’a pas pu être actualisée.",
    });
  }

  async function submitCareUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCareForManagement) return;
    const form = new FormData(event.currentTarget);
    await runMutation(async () => {
      return updateCare(selectedCareForManagement.id, {
        planned_sessions: Number(form.get("planned_sessions") || selectedCareForManagement.planned_sessions),
        price_per_session: String(form.get("price_per_session") || selectedCareForManagement.price_per_session),
        end_date: String(form.get("end_date") || "") || null,
        notes: String(form.get("notes") ?? "").trim(),
      });
    }, "Soin mis à jour.", {
      onSuccess: (care) => {
        setCares((current) => replaceById(current, care));
        setCareFormMode(null);
      },
      refreshFailure: "Le soin a été mis à jour, mais la liste n’a pas pu être actualisée.",
    });
  }

  async function submitNewSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!careForNewSession) return;
    await runMutation(async () => {
      return createCareSession({
        care: Number(careForNewSession),
        scheduled_at: toIsoFromLocal(form.get("scheduled_at")),
        notes: String(form.get("notes") ?? "").trim(),
      });
    }, "Séance de soin enregistrée.", {
      onSuccess: (session) => {
        setSessions((current) => mergeCreatedSession(current, session));
        setFilter("ALL");
        setSelectedId(session.id);
        setSessionFormOpen(false);
        formElement.reset();
      },
      refreshFailure: "La séance a été enregistrée, mais la liste n’a pas pu être actualisée.",
    });
  }

  async function submitMeasurement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await runMutation(async () => {
      return createClinicalMeasurement({
        care_session: selected.id,
        measurement_type: String(form.get("measurement_type")) as ClinicalMeasurementType,
        value: String(form.get("value") ?? "").trim(),
        unit: String(form.get("unit") ?? "").trim(),
        notes: String(form.get("notes") ?? "").trim(),
      });
    }, "Mesure enregistrée.", {
      onSuccess: () => formElement.reset(),
    });
  }

  async function submitMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await runMutation(async () => {
      return createCareSessionMaterial({
        care_session: selected.id,
        name: String(form.get("name") ?? "").trim(),
        quantity: String(form.get("quantity") ?? "").trim(),
        unit: String(form.get("unit") ?? "").trim(),
        notes: String(form.get("notes") ?? "").trim(),
      });
    }, "Matériel enregistré.", {
      onSuccess: () => formElement.reset(),
    });
  }

  async function saveParameters() {
    if (!selected) return;
    await runMutation(async () => {
      await Promise.all(definitions.map((definition) => {
        const value = parameterValues[definition.id] ?? "";
        const existing = parameters.find((parameter) => parameter.parameter_definition === definition.id);
        if (existing) return updateCareSessionParameter(existing.id, { value });
        return createCareSessionParameter({ care_session: selected.id, parameter_definition: definition.id, value });
      }));
    }, "Paramètres enregistrés.");
  }

  const selectedCare = selected ? careById.get(selected.care) : undefined;
  const editable = selected?.status === "IN_PROGRESS";

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Soins infirmiers</p>
          <h1>Soins</h1>
          <p>Gestion des soins, séances et traçabilité clinique.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondary} onClick={() => setCareFormMode("create")}>Nouveau soin</button>
          <button className={styles.primary} disabled={!activeCares.length} onClick={() => setSessionFormOpen(true)}>Nouvelle séance</button>
        </div>
      </header>
      {(actionError || loadError) && <p className={styles.error} role="alert">{actionError || loadError}</p>}
      {message && <p className={styles.feedback} role="status">{message}</p>}
      <div className={styles.toolbar}>
        <select aria-label="Statut des séances" value={filter} onChange={(event) => setFilter(event.target.value as CareSessionStatus | "TODAY" | "ALL")}>
          {sessionFilters.map((item) => <option key={item} value={item}>{sessionFilterLabel(item)}</option>)}
        </select>
        <input aria-label="Rechercher une séance" placeholder="Patient ou soin..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className={styles.summary} aria-label="Résumé des séances">
        <span>À réaliser <strong>{plannedSessions}</strong></span>
        <span>En cours <strong>{inProgressSessions}</strong></span>
        <span>Terminées aujourd’hui <strong>{completedToday}</strong></span>
      </div>
      {loading ? <p className={styles.panel} role="status">Chargement des séances...</p> : (
        <div className={`${styles.careWorkspace} ${!selected ? styles.careWorkspaceWide : ""}`}>
          <div className={styles.primaryColumn}>
            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>Soins et séances</p>
                  <h2>Plans actifs</h2>
                </div>
                {selectedCareForManagement && <button className={styles.secondary} onClick={() => setCareFormMode("edit")}>Modifier</button>}
              </div>
              {!activeCares.length ? <p>Aucun soin pour les filtres sélectionnés.</p> : (
                <div className={styles.careList}>
                  {activeCares.map((care) => (
                    <button key={care.id} className={styles.careCard} aria-pressed={care.id === selectedCareForManagement?.id} onClick={() => setCareForNewSession(care.id)}>
                      <span>
                        <strong>{care.patient_name}</strong>
                        <small>{care.care_type_name}</small>
                      </span>
                      <span className={styles.careMeta}>
                        <span>{care.completed_sessions} / {care.planned_sessions} séances</span>
                        <StatusBadge tone={care.status === "COMPLETED" ? "success" : care.status === "IN_PROGRESS" ? "teal" : "neutral"}>{careStatusLabels[care.status]}</StatusBadge>
                      </span>
                      <progress value={care.completed_sessions} max={care.planned_sessions} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          <section className={styles.panel}>
            <h2>Séances de soin</h2>
            {loadError && !sessions.length ? <p>Impossible de charger les soins.</p> : !visibleSessions.length ? <p>Aucune séance ne correspond aux filtres.</p> : (
              <div className={styles.sessionList}>
                {visibleSessions.map((session) => {
                  return (
                    <button key={session.id} className={styles.sessionCard} data-active={session.id === selected?.id} onClick={() => setSelectedId(session.id)}>
                      <strong>{session.patient_name}</strong>
                      <span>{session.care_type_name}</span>
                      <small>{careSessionTime(session)}</small>
                      <StatusBadge tone={session.status === "COMPLETED" ? "success" : session.status === "IN_PROGRESS" ? "teal" : "neutral"}>{sessionStatusLabels[session.status]}</StatusBadge>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          </div>
          {selected && selectedCare ? (
            <section className={`${styles.panel} ${styles.execution}`} aria-label="Fiche d’exécution">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>Séance de soin</p>
                  <h2>{selected.care_type_name}</h2>
                </div>
                <StatusBadge tone={selected.status === "COMPLETED" ? "success" : selected.status === "IN_PROGRESS" ? "teal" : "neutral"}>{sessionStatusLabels[selected.status]}</StatusBadge>
              </div>
              <div className={styles.identity}>
                <span>{selected.patient_name.split(" ").map((part) => part[0]).join("").slice(0, 2) || "P"}</span>
                <div>
                  <strong>{selected.patient_name}</strong>
                  <p>{careSessionTime(selected)}</p>
                  <p>Soin : {careStatusLabels[selected.care_status]} · Séance : {sessionStatusLabels[selected.status]}</p>
                </div>
              </div>
              <MedicalAlertsSummary patientId={selectedCare.patient} />
              <div className={styles.inset}>
                <p>{selected.notes || "Aucune note de planification."}</p>
                <div className={styles.progressLabel}><span>{selected.completed_sessions}/{selected.planned_sessions} séances réalisées</span><strong>{selected.remaining_sessions} restantes</strong></div>
                <progress value={selected.completed_sessions} max={selected.planned_sessions} />
                <p>{selected.progress_percentage}% · {decimalAmount(selected.care_total_price)}</p>
              </div>
              <div className={styles.inset}>
                <small>Instructions médicales en lecture seule</small>
                <p>{selectedCare.notes || "Aucune instruction renseignée."}</p>
              </div>
              <div className={styles.actions}>
                {selected.status === "PLANNED" && <button className={styles.primary} disabled={busy} onClick={() => runMutation(() => startCareSession(selected.id), "Séance démarrée.")}>Commencer</button>}
                {selected.status === "IN_PROGRESS" && <button className={styles.primary} disabled={busy} onClick={() => runMutation(() => completeCareSession(selected.id), "Séance terminée.")}>Terminer</button>}
                <Link href={`/nurse/patients/${selected.patient_reference}`}>Dossier patient</Link>
              </div>
              <section>
                <h3>Paramètres dynamiques</h3>
                {!definitions.length ? <p>Aucun paramètre actif configuré pour ce type de soin.</p> : (
                  <div className={ui.form}>
                    {definitions.map((definition) => (
                      <label key={definition.id}>{definition.label}{definition.required ? " *" : ""}{definition.unit ? ` (${definition.unit})` : ""}
                        {definition.data_type === "BOOLEAN" ? (
                          <select disabled={!editable || busy} value={parameterValues[definition.id] ?? ""} onChange={(event) => setParameterValues((current) => ({ ...current, [definition.id]: event.target.value }))}>
                            <option value="">Non renseigné</option>
                            <option value="true">Oui</option>
                            <option value="false">Non</option>
                          </select>
                        ) : (
                          <input disabled={!editable || busy} type={parameterInputType(definition)} value={parameterValues[definition.id] ?? ""} onChange={(event) => setParameterValues((current) => ({ ...current, [definition.id]: event.target.value }))} />
                        )}
                      </label>
                    ))}
                    {editable && <button className={ui.action} disabled={busy} onClick={saveParameters}>Enregistrer les paramètres</button>}
                  </div>
                )}
              </section>
              <section>
                <h3>Observations infirmières</h3>
                {editable && <form className={ui.form} onSubmit={submitObservation}><label>Observation<textarea value={observationText} onChange={(event) => setObservationText(event.target.value)} required /></label><button className={ui.action} disabled={busy || !observationText.trim()}>Ajouter</button></form>}
                {observations.length ? <ul>{observations.map((item) => <li key={item.id}>{dateTime(item.created_at)} · {item.observation}</li>)}</ul> : <p>Aucune observation.</p>}
              </section>
              <section>
                <h3>Mesures cliniques</h3>
                {editable && <form className={ui.form} onSubmit={submitMeasurement}>
                  <label>Type<select name="measurement_type" required>{measurementTypes.map((type) => <option key={type} value={type}>{measurementTypeLabels[type]}</option>)}</select></label>
                  <label>Valeur<input name="value" required /></label>
                  <label>Unité<input name="unit" required /></label>
                  <label>Notes<textarea name="notes" /></label>
                  <button className={ui.action} disabled={busy}>Ajouter la mesure</button>
                </form>}
                {measurements.length ? <ul>{measurements.map((item) => <li key={item.id}>{measurementTypeLabels[item.measurement_type]} · {item.value} {item.unit} · {dateTime(item.recorded_at)}</li>)}</ul> : <p>Aucune mesure.</p>}
              </section>
              <section>
                <h3>Matériel utilisé</h3>
                {editable && <form className={ui.form} onSubmit={submitMaterial}>
                  <label>Nom<input name="name" required /></label>
                  <label>Quantité<input name="quantity" inputMode="decimal" required /></label>
                  <label>Unité<input name="unit" required /></label>
                  <label>Notes<textarea name="notes" /></label>
                  <button className={ui.action} disabled={busy}>Ajouter le matériel</button>
                </form>}
                {materials.length ? <ul>{materials.map((item) => <li key={item.id}>{item.name} · {item.quantity} {item.unit}{item.notes ? ` · ${item.notes}` : ""}</li>)}</ul> : <p>Aucun matériel enregistré.</p>}
              </section>
            </section>
          ) : <div className={styles.empty}>Sélectionnez une séance.</div>}
        </div>
      )}
      <DetailDialog title={careFormMode === "edit" ? "Modifier le soin" : "Nouveau soin"} open={careFormMode !== null} onClose={() => setCareFormMode(null)}>
        {careFormMode === "create" && (patients.length && careTypes.length ? (
          <form className={ui.form} onSubmit={submitNewCare}>
            <div className={styles.modalGrid}>
              <label>Patient
                <select value={newCarePatient} onChange={(event) => setNewCarePatient(Number(event.target.value))} required>
                  {patients.map((patient) => <option key={patient.apiId} value={patient.apiId}>{patient.name}</option>)}
                </select>
              </label>
              <label>Type de soin
                <select value={newCareType} onChange={(event) => setNewCareType(Number(event.target.value))} required>
                  {careTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>Début<input name="start_date" type="date" defaultValue={todayKey()} required /></label>
              <label>Fin<input name="end_date" type="date" /></label>
              <label>Séances prévues<input name="planned_sessions" type="number" min={1} defaultValue={1} required /></label>
              <label>Prix par séance<input name="price_per_session" inputMode="decimal" defaultValue={careTypes.find((item) => item.id === Number(newCareType))?.default_price ?? "0.00"} required /></label>
            </div>
            <label>Notes<textarea name="notes" /></label>
            <div className={ui.actions}>
              <button className={`${ui.action} ${ui.primary}`} disabled={busy || !newCarePatient || !newCareType}>{busy ? "Création..." : "Créer le soin"}</button>
              <button className={ui.action} type="button" disabled={busy} onClick={() => setCareFormMode(null)}>Annuler</button>
            </div>
          </form>
        ) : <p>Aucun patient ou type de soin disponible.</p>)}
        {careFormMode === "edit" && selectedCareForManagement && (
          <form className={ui.form} onSubmit={submitCareUpdate}>
            <p>{selectedCareForManagement.patient_name} · {selectedCareForManagement.care_type_name}</p>
            <div className={styles.modalGrid}>
              <label>Séances prévues<input name="planned_sessions" type="number" min={selectedCareForManagement.completed_sessions} defaultValue={selectedCareForManagement.planned_sessions} required /></label>
              <label>Prix par séance<input name="price_per_session" inputMode="decimal" defaultValue={selectedCareForManagement.price_per_session} required /></label>
              <label>Fin<input name="end_date" type="date" defaultValue={selectedCareForManagement.end_date ?? ""} /></label>
            </div>
            <label>Notes<textarea name="notes" defaultValue={selectedCareForManagement.notes} /></label>
            <div className={ui.actions}>
              <button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer les modifications"}</button>
              <button className={ui.action} type="button" disabled={busy} onClick={() => setCareFormMode(null)}>Annuler</button>
            </div>
          </form>
        )}
      </DetailDialog>
      <DetailDialog title="Nouvelle séance" open={sessionFormOpen} onClose={() => setSessionFormOpen(false)}>
        {activeCares.length ? (
          <form className={ui.form} onSubmit={submitNewSession}>
            <label>Soin
              <select value={careForNewSession} onChange={(event) => setCareForNewSession(Number(event.target.value))} required>
                {activeCares.map((care) => (
                  <option key={care.id} value={care.id}>{care.patient_name} · {care.care_type_name} · {care.remaining_sessions} restantes</option>
                ))}
              </select>
            </label>
            <label>Date et heure<input name="scheduled_at" type="datetime-local" defaultValue={localDateTimeInput()} required /></label>
            <label>Note de planification<textarea name="notes" /></label>
            <div className={ui.actions}>
              <button className={`${ui.action} ${ui.primary}`} disabled={busy || !careForNewSession}>{busy ? "Enregistrement..." : "Enregistrer la séance"}</button>
              <button className={ui.action} type="button" disabled={busy} onClick={() => setSessionFormOpen(false)}>Annuler</button>
            </div>
          </form>
        ) : <p>Aucun soin disponible pour une nouvelle séance.</p>}
      </DetailDialog>
    </main>
  );
}
