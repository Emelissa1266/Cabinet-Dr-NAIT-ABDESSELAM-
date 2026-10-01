"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import type { SurgeryApi } from "../api-types";
import { dateTime, statusTone, surgeryErrorMessage, surgeryStatusLabels } from "../services/surgery-display";
import { listSurgeries } from "../services/surgery-api-service";

export function PatientSurgerySection({ patient }: { patient: Patient }) {
  const [surgeries, setSurgeries] = useState<SurgeryApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      listSurgeries({ patient: patient.apiId, ordering: "-planned_date" })
        .then((response) => {
          if (active) setSurgeries(response.results);
        })
        .catch((cause) => {
          if (active) setError(surgeryErrorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [patient.apiId]);

  if (loading) return <section className={ui.panel}><h2>Interventions</h2><p role="status">Chargement des interventions...</p></section>;
  if (error) return <section className={ui.panel}><h2>Interventions</h2><p role="alert">{error}</p></section>;

  return (
    <section className={ui.panel}>
      <div className={ui.heading}>
        <div>
          <h2>Interventions</h2>
          <p>Historique chirurgical chargé depuis le backend Surgery.</p>
        </div>
        <Link className={ui.action} href="/interventions">Ouvrir le module</Link>
      </div>
      {!surgeries.length ? <p>Aucune intervention enregistrée pour ce patient.</p> : (
        <div className={ui.tableScroll}>
          <table className={ui.table}>
            <thead><tr><th>Date</th><th>Intervention</th><th>Statut</th><th>Anesthésie</th></tr></thead>
            <tbody>
              {surgeries.map((surgery) => (
                <tr key={surgery.id}>
                  <td>{dateTime(surgery.planned_date)}<small>#{surgery.id}</small></td>
                  <td>{surgery.procedure_name}<small>{surgery.anatomical_site || surgery.procedure_code}</small></td>
                  <td><StatusBadge tone={statusTone(surgery.status)}>{surgeryStatusLabels[surgery.status]}</StatusBadge></td>
                  <td>{surgery.anesthesia_type || "Non renseignée"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
