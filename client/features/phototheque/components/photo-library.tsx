"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/components/auth-provider";
import { PatientPhotosSection } from "@/features/documents/components/patient-photos-section";
import type { Patient } from "@/features/patients/types";
import { listPatients } from "@/features/patients/services/patient-service";
import ui from "@/components/ui/clinical.module.css";
import workspace from "@/components/ui/module-workspace.module.css";

export function PhotoLibrary({ initialPatientId }: { initialPatientId?: string }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const allowed = user?.role === "ADMIN" || user?.role === "DOCTOR" || user?.role === "NURSE";

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const page = await listPatients({ search: query, ordering: "last_name" });
      setPatients(page.results);
      setSelectedId((current) => {
        const initialMatch = page.results.find(
          (patient) => patient.id === initialPatientId
            || String(patient.apiId) === initialPatientId
            || patient.patientReference === initialPatientId,
        );
        if (initialMatch) return String(initialMatch.apiId);
        if (current && page.results.some((patient) => String(patient.apiId) === current)) return current;
        return page.results[0] ? String(page.results[0].apiId) : "";
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chargement de la photothèque impossible.");
    } finally {
      setLoading(false);
    }
  }, [allowed, initialPatientId, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = useMemo(
    () => patients.find((patient) => String(patient.apiId) === selectedId) ?? null,
    [patients, selectedId],
  );

  if (!allowed) {
    return (
      <section className={ui.panel}>
        <h1>Photothèque</h1>
        <p>Les photographies cliniques ne sont pas disponibles pour ce rôle.</p>
      </section>
    );
  }

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Imagerie clinique privée</p>
          <h1 className={ui.title}>Photothèque</h1>
          <p className={ui.description}>Clichés patients servis par endpoints authentifiés, sans URL média publique.</p>
        </div>
      </header>
      <div className={ui.toolbar}>
        <label className={ui.search}>
          <span className="sr-only">Rechercher un patient</span>
          <input placeholder="Patient ou référence…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className={workspace.filters}>
          <label>Patient
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Sélectionner un patient</option>
              {patients.map((patient) => (
                <option key={patient.apiId} value={patient.apiId}>{patient.name} · {patient.patientReference}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error && <p role="alert" className={ui.panel}>{error}</p>}
      {loading ? <p role="status" className={ui.panel}>Chargement de la photothèque…</p> : (
        selected ? <PatientPhotosSection patient={selected} /> : <section className={ui.panel}><p>Aucun patient réel disponible.</p></section>
      )}
    </div>
  );
}
