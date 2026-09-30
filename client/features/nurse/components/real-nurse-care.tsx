"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import {
  createCareObservation,
  createCareSessionMaterial,
  createCareSessionParameter,
  createClinicalMeasurement,
  completeCareSession,
  getCare,
  listCareObservations,
  listCareParameterDefinitions,
  listCareSessionMaterials,
  listCareSessionParameters,
  listCareSessions,
  listCareTypes,
  listClinicalMeasurements,
  startCareSession,
  updateCareSessionParameter,
} from "@/features/care/services/care-api-service";
import {
  careErrorMessage,
  careSessionTime,
  careStatusLabels,
  careType,
  careTypeName,
  dateOnly,
  decimalAmount,
  measurementTypeLabels,
  patientName,
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
import { getPatient } from "@/features/patients/services/patient-service";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import styles from "./nurse.module.css";

const sessionFilters: Array<CareSessionStatus | "TODAY" | "ALL"> = ["TODAY", "PLANNED", "IN_PROGRESS", "COMPLETED", "ALL"];
const measurementTypes = Object.keys(measurementTypeLabels) as ClinicalMeasurementType[];

function dateKey(value: string) {
  return value.slice(0, 10);
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CareSessionApi[]>([]);
  const [cares, setCares] = useState<CareApi[]>([]);
  const [careTypes, setCareTypes] = useState<CareTypeApi[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialSession && /^\d+$/.test(initialSession) ? Number(initialSession) : null);
  const [filter, setFilter] = useState<CareSessionStatus | "TODAY" | "ALL">(initialSession ? "ALL" : "TODAY");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.apiId, patient])), [patients]);
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
        const patient = care ? patientById.get(care.patient) : undefined;
        const type = care ? careType(care, careTypes) : undefined;
        return `${patientName(patient)} ${careTypeName(type)} ${session.notes}`.toLocaleLowerCase("fr").includes(normalizedQuery);
      });
  }, [careById, careTypes, filter, patientById, query, sessions]);

  const loadSessions = useCallback(async () => {
    const [sessionPage, typePage] = await Promise.all([
      listCareSessions({ ordering: "scheduled_at" }),
      listCareTypes({ ordering: "name" }),
    ]);
    const uniqueCareIds = [...new Set(sessionPage.results.map((session) => session.care))];
    const careList = await Promise.all(uniqueCareIds.map((id) => getCare(id)));
    const uniquePatientIds = [...new Set(careList.map((care) => care.patient))];
    const patientList = await Promise.all(uniquePatientIds.map((id) => getPatient(String(id))));
    setSessions(sessionPage.results);
    setCareTypes(typePage.results);
    setCares(careList);
    setPatients(patientList);
    setSelectedId((current) => sessionPage.results.find((session) => session.id === current)?.id ?? sessionPage.results[0]?.id ?? null);
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
  }, [loadSessions]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      loadSelectedRecords().catch((cause) => {
        if (active) setError(careErrorMessage(cause));
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadSelectedRecords]);

  async function runMutation(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await loadSessions();
      await loadSelectedRecords();
      setMessage(success);
    } catch (cause) {
      setError(careErrorMessage(cause));
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

  async function submitMeasurement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await runMutation(async () => {
      await createClinicalMeasurement({
        care_session: selected.id,
        measurement_type: String(form.get("measurement_type")) as ClinicalMeasurementType,
        value: String(form.get("value") ?? "").trim(),
        unit: String(form.get("unit") ?? "").trim(),
        notes: String(form.get("notes") ?? "").trim(),
      });
      event.currentTarget.reset();
    }, "Mesure enregistrée.");
  }

  async function submitMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await runMutation(async () => {
      await createCareSessionMaterial({
        care_session: selected.id,
        name: String(form.get("name") ?? "").trim(),
        quantity: String(form.get("quantity") ?? "").trim(),
        unit: String(form.get("unit") ?? "").trim(),
        notes: String(form.get("notes") ?? "").trim(),
      });
      event.currentTarget.reset();
    }, "Matériel enregistré.");
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
  const selectedPatient = selectedCare ? patientById.get(selectedCare.patient) : undefined;
  const selectedCareType = selectedCare ? careType(selectedCare, careTypes) : undefined;
  const editable = selected?.status === "IN_PROGRESS";

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Soins assignés</p>
          <h1>Soins</h1>
          <p>Exécution infirmière réelle, paramètres dynamiques et traçabilité backend.</p>
        </div>
        <span className={styles.dateBadge}>{user?.displayName ?? user?.username ?? "Infirmier(ère)"} · Backend Care</span>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.feedback} role="status">{message}</p>}
      <div className={styles.toolbar}>
        <select aria-label="Statut des séances" value={filter} onChange={(event) => setFilter(event.target.value as CareSessionStatus | "TODAY" | "ALL")}>
          {sessionFilters.map((item) => <option key={item} value={item}>{sessionFilterLabel(item)}</option>)}
        </select>
        <input aria-label="Rechercher une séance" placeholder="Patient ou soin..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      {loading ? <p className={styles.panel} role="status">Chargement des séances...</p> : (
        <div className={styles.columns}>
          <section className={styles.panel}>
            <h2>Séances autorisées</h2>
            {!visibleSessions.length ? <p>Aucune séance ne correspond aux filtres.</p> : (
              <div className={styles.sessionList}>
                {visibleSessions.map((session) => {
                  const care = careById.get(session.care);
                  const patient = care ? patientById.get(care.patient) : undefined;
                  const type = care ? careType(care, careTypes) : undefined;
                  return (
                    <button key={session.id} className={styles.sessionCard} data-active={session.id === selected?.id} onClick={() => setSelectedId(session.id)}>
                      <strong>{patientName(patient)}</strong>
                      <span>{careTypeName(type)}</span>
                      <small>#{session.id} · {careSessionTime(session)}</small>
                      <StatusBadge tone={session.status === "COMPLETED" ? "success" : session.status === "IN_PROGRESS" ? "teal" : "neutral"}>{sessionStatusLabels[session.status]}</StatusBadge>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          {selected && selectedCare ? (
            <section className={`${styles.panel} ${styles.execution}`} aria-label="Fiche d’exécution réelle">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>Séance #{selected.id}</p>
                  <h2>{careTypeName(selectedCareType)}</h2>
                </div>
                <StatusBadge tone={selected.status === "COMPLETED" ? "success" : selected.status === "IN_PROGRESS" ? "teal" : "neutral"}>{sessionStatusLabels[selected.status]}</StatusBadge>
              </div>
              <div className={styles.identity}>
                <span>{selectedPatient?.initials ?? "P"}</span>
                <div>
                  <strong>{patientName(selectedPatient)}</strong>
                  <p>{selectedPatient?.patientReference ?? `Patient #${selectedCare.patient}`} · {dateOnly(selectedCare.start_date)}</p>
                  <p>Plan #{selectedCare.id} · {careStatusLabels[selectedCare.status]} · {decimalAmount(selectedCare.total_price)}</p>
                </div>
              </div>
              <div className={styles.inset}>
                <p>{careSessionTime(selected)} · {selected.notes || "Aucune note de planification."}</p>
                <div className={styles.progressLabel}><span>{selectedCare.completed_sessions}/{selectedCare.planned_sessions} séances réalisées</span><strong>{selectedCare.remaining_sessions} restantes</strong></div>
                <progress value={selectedCare.completed_sessions} max={selectedCare.planned_sessions} />
                <p>{selectedCare.progress_percentage}% calculé par le backend.</p>
              </div>
              <div className={styles.inset}>
                <small>Instructions médicales en lecture seule</small>
                <p>{selectedCare.notes || selectedCareType?.description || "Aucune instruction renseignée."}</p>
              </div>
              <div className={styles.actions}>
                {selected.status === "PLANNED" && <button className={styles.primary} disabled={busy} onClick={() => runMutation(() => startCareSession(selected.id), "Séance démarrée.")}>Commencer</button>}
                {selected.status === "IN_PROGRESS" && <button className={styles.primary} disabled={busy} onClick={() => runMutation(() => completeCareSession(selected.id), "Séance terminée.")}>Terminer</button>}
                {selectedPatient && <Link href={`/nurse/patients/${selectedPatient.id}`}>Dossier patient</Link>}
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
                {observations.length ? <ul>{observations.map((item) => <li key={item.id}>{new Date(item.created_at).toLocaleString("fr-DZ")} · {item.observation}</li>)}</ul> : <p>Aucune observation.</p>}
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
                {measurements.length ? <ul>{measurements.map((item) => <li key={item.id}>{measurementTypeLabels[item.measurement_type]} · {item.value} {item.unit} · {new Date(item.recorded_at).toLocaleString("fr-DZ")}</li>)}</ul> : <p>Aucune mesure.</p>}
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
    </main>
  );
}
