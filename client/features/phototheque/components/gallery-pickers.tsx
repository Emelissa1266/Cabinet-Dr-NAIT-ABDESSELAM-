"use client";

import { useEffect, useState } from "react";
import { listPatients } from "@/features/patients/services/patient-service";
import type { Patient } from "@/features/patients/types";
import type { ClinicalPhotoSetApi } from "@/features/documents/api-types";
import { listClinicalPhotoSets } from "@/features/documents/services/document-api-service";
import { clinicalPhotoErrorMessage } from "@/features/documents/services/photo-workflow";

export function PatientPicker({ value, onChange, all = false, disabled = false, label = "Patient", currentLabel }: {
  value: string; onChange: (id: string) => void; all?: boolean; disabled?: boolean; label?: string; currentLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [next, setNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const result = await listPatients({ search: query, page, ordering: "last_name" });
        if (active) { setPatients(current => page === 1 ? result.results : [...current, ...result.results]); setNext(Boolean(result.next)); }
      } catch (cause) { if (active) setError(clinicalPhotoErrorMessage(cause, "Impossible de charger les patients.")); }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, page]);
  return <div>
    {!disabled && <label>Rechercher un patient<input type="search" value={query} placeholder="Nom ou référence du patient" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>}
    <label>{label}<select required={!all} disabled={disabled} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{all ? "Tous les patients" : "Sélectionner un patient"}</option>
      {value && !patients.some(p => p.id === value) && <option value={value}>{currentLabel || "Patient sélectionné"}</option>}
      {patients.map(p => <option key={p.id} value={p.id}>{p.name} · {p.patientReference}</option>)}
    </select></label>
    {loading && <small role="status">Chargement des patients…</small>}
    {error && <p role="alert">{error}</p>}
    {next && !disabled && <button type="button" disabled={loading} onClick={() => setPage(p => p + 1)}>Plus de patients</button>}
  </div>;
}

export function SeriesPicker({ patient, value, onChange, currentSet, label = "Série", emptyLabel = "Toutes les séries" }: {
  patient: string; value: string; onChange: (id: string, set?: ClinicalPhotoSetApi) => void; currentSet?: ClinicalPhotoSetApi; label?: string; emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sets, setSets] = useState<ClinicalPhotoSetApi[]>([]);
  const [next, setNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const result = await listClinicalPhotoSets({ patient: patient || undefined, page, search: query });
        if (active) { setSets(current => page === 1 ? result.results : [...current, ...result.results]); setNext(Boolean(result.next)); }
      } catch (cause) { if (active) setError(clinicalPhotoErrorMessage(cause, "Impossible de charger les séries.")); }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [patient, query, page]);
  return <div>
    <label>Rechercher une série<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Titre de la série" /></label>
    <label>{label}<select value={value} disabled={loading} onChange={e => onChange(e.target.value, sets.find(s => String(s.id) === e.target.value))}>
      <option value="">{emptyLabel}</option>
      {value && !sets.some(s => String(s.id) === value) && <option value={value}>{currentSet?.title || "Série sélectionnée"}</option>}
      {sets.filter(s => !patient || String(s.patient) === patient).map(s => <option key={s.id} value={s.id}>{s.title} · {s.anatomical_area}</option>)}
    </select></label>
    {error && <p role="alert">{error}</p>}
    {!loading && !sets.length && !error && <small>Aucune série créée pour cette sélection.</small>}
    {next && <button type="button" disabled={loading} onClick={() => setPage(p => p + 1)}>Plus de séries</button>}
  </div>;
}
