"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import {
  medicalAlertCategoryLabel,
  medicalAlertSeverityLabel,
} from "@/lib/presentation";
import ui from "@/components/ui/clinical.module.css";
import type { MedicalAlert, MedicalAlertCategory, MedicalAlertSeverity, Patient } from "../types";
import {
  createMedicalAlert,
  listMedicalAlerts,
  resolveMedicalAlert,
} from "../services/medical-alert-service";
import { patientErrorMessage } from "../services/patient-errors";

const categories: MedicalAlertCategory[] = ["ALLERGY", "MEDICATION", "CONTRAINDICATION", "MEDICAL_CONDITION", "ANESTHESIA", "OTHER"];
const severities: MedicalAlertSeverity[] = ["INFO", "WARNING", "CRITICAL"];

function tone(severity: MedicalAlertSeverity) {
  if (severity === "CRITICAL") return "error" as const;
  if (severity === "WARNING") return "warning" as const;
  return "neutral" as const;
}

function severityRank(severity: MedicalAlertSeverity) {
  if (severity === "CRITICAL") return 0;
  if (severity === "WARNING") return 1;
  return 2;
}

export function MedicalAlertsSummary({ patientId, compact = false }: { patientId: number; compact?: boolean }) {
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      listMedicalAlerts({ patient: patientId, is_active: true, ordering: "-severity,-created_at" })
        .then((response) => {
          if (active) setAlerts(response.results);
        })
        .catch(() => {
          if (active) setAlerts([]);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [patientId]);

  const important = alerts
    .filter((alert) => alert.severity === "WARNING" || alert.severity === "CRITICAL")
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  if (!important.length) return null;

  return (
    <section className={compact ? ui.panel : ui.empty} aria-label="Alertes médicales actives">
      <strong>⚠ {important.length} alerte{important.length > 1 ? "s" : ""} médicale{important.length > 1 ? "s" : ""}</strong>
      <ul>
        {important.slice(0, compact ? 3 : important.length).map((alert) => (
          <li key={alert.id}>
            {medicalAlertCategoryLabel(alert.category)} — {alert.title} — {medicalAlertSeverityLabel(alert.severity)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MedicalAlertsPanel({ patient }: { patient: Patient }) {
  const { user } = useAuth();
  const canWrite = user?.role === "DOCTOR";
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeAlerts = useMemo(() => alerts.filter((alert) => alert.is_active).sort((a, b) => severityRank(a.severity) - severityRank(b.severity)), [alerts]);
  const historicalAlerts = useMemo(() => alerts.filter((alert) => !alert.is_active), [alerts]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listMedicalAlerts({ patient: patient.apiId, ordering: "-is_active,-created_at" });
      setAlerts(response.results);
    } catch (cause) {
      setError(patientErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [patient.apiId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await createMedicalAlert({
        patient: patient.apiId,
        category: String(form.get("category")) as MedicalAlertCategory,
        severity: String(form.get("severity")) as MedicalAlertSeverity,
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
      });
      setOpen(false);
      await load();
    } catch (cause) {
      setError(patientErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(alert: MedicalAlert) {
    setBusy(true);
    setError("");
    try {
      await resolveMedicalAlert(alert.id);
      await load();
    } catch (cause) {
      setError(patientErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={ui.panel}>
      <div className={ui.actions}>
        <h2>Alertes médicales</h2>
        {canWrite && <button className={`${ui.action} ${ui.primary}`} onClick={() => setOpen(true)}>Ajouter</button>}
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Chargement des alertes...</p> : activeAlerts.length ? (
        <ul>
          {activeAlerts.map((alert) => (
            <li key={alert.id}>
              <strong>{medicalAlertCategoryLabel(alert.category)} — {alert.title}</strong>{" "}
              <StatusBadge tone={tone(alert.severity)}>{medicalAlertSeverityLabel(alert.severity)}</StatusBadge>
              {alert.description && <p>{alert.description}</p>}
              {canWrite && <button className={ui.action} disabled={busy} onClick={() => resolve(alert)}>Résoudre</button>}
            </li>
          ))}
        </ul>
      ) : <p>Aucune alerte médicale active.</p>}
      {historicalAlerts.length > 0 && <details><summary>Alertes résolues</summary><ul>{historicalAlerts.map((alert) => <li key={alert.id}>{medicalAlertCategoryLabel(alert.category)} — {alert.title}</li>)}</ul></details>}
      <DetailDialog title="Ajouter une alerte médicale" open={open} onClose={() => setOpen(false)}>
        <form className={ui.form} onSubmit={submit}>
          <label>Catégorie<select name="category" required>{categories.map((category) => <option key={category} value={category}>{medicalAlertCategoryLabel(category)}</option>)}</select></label>
          <label>Niveau<select name="severity" defaultValue="WARNING" required>{severities.map((severity) => <option key={severity} value={severity}>{medicalAlertSeverityLabel(severity)}</option>)}</select></label>
          <label>Titre<input name="title" required maxLength={180} /></label>
          <label>Description<textarea name="description" /></label>
          <div className={ui.actions}>
            <button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Ajout..." : "Ajouter l’alerte"}</button>
            <button className={ui.action} type="button" disabled={busy} onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </form>
      </DetailDialog>
    </section>
  );
}
