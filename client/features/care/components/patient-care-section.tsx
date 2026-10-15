"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import type { CareApi, CareSessionApi, CareTypeApi } from "../api-types";
import {
  careErrorMessage,
  careSessionTime,
  careStatusLabels,
  careType,
  careTypeName,
  dateOnly,
  decimalAmount,
  sessionStatusLabels,
} from "../services/care-display";
import { listAllCares, listAllCareSessions, listCareTypes } from "../services/care-api-service";

export function PatientCareSection({ patient }: { patient: Patient }) {
  const [cares, setCares] = useState<CareApi[]>([]);
  const [careTypes, setCareTypes] = useState<CareTypeApi[]>([]);
  const [sessionsByCare, setSessionsByCare] = useState<Record<number, CareSessionApi[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const [carePage, typePage] = await Promise.all([
        listAllCares({ patient: patient.apiId, ordering: "-start_date" }),
        listCareTypes({ ordering: "name" }),
      ]);
      const sessionEntries = await Promise.all(
        carePage.results.map(async (care) => {
          const response = await listAllCareSessions({ care: care.id, ordering: "scheduled_at" });
          return [care.id, response.results] as const;
        }),
      );
      if (!active) return;
      setCares(carePage.results);
      setCareTypes(typePage.results);
      setSessionsByCare(Object.fromEntries(sessionEntries));
    }
    load()
      .catch((cause) => {
        if (active) setError(careErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patient.apiId]);

  if (loading) return <section className={ui.panel}><h2>Soins</h2><p role="status">Chargement des soins...</p></section>;
  if (error) return <section className={ui.panel}><h2>Soins</h2><p role="alert">{error}</p></section>;

  return (
    <section className={ui.panel}>
      <div className={ui.heading}>
        <div>
          <h2>Soins</h2>
          <p>Plans de soins, progression et séances du patient.</p>
        </div>
        <Link className={ui.action} href="/care">Ouvrir le module</Link>
      </div>
      {!cares.length ? <p>Aucun plan de soin enregistré pour ce patient.</p> : (
        <div className={ui.tableScroll}>
          <table className={ui.table}>
            <thead><tr><th>Soin</th><th>Statut</th><th>Séances</th><th>Prix</th></tr></thead>
            <tbody>
              {cares.map((care) => {
                const type = careType(care, careTypes);
                return (
                  <tr key={care.id}>
                    <td><strong>{careTypeName(type)}</strong><small>{patient.name} · début {dateOnly(care.start_date)}</small></td>
                    <td><StatusBadge tone={care.status === "COMPLETED" ? "success" : care.status === "IN_PROGRESS" ? "teal" : "neutral"}>{careStatusLabels[care.status]}</StatusBadge></td>
                    <td>{care.completed_sessions}/{care.planned_sessions}<small>{care.remaining_sessions} restantes · {care.progress_percentage}%</small></td>
                    <td>{decimalAmount(care.total_price)}<small>{decimalAmount(care.price_per_session)} / séance</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {cares.map((care) => {
        const sessions = sessionsByCare[care.id] ?? [];
        const type = careType(care, careTypes);
        if (!sessions.length) return null;
        return (
          <div key={`sessions-${care.id}`}>
            <h3>Séances - {careTypeName(type)}</h3>
            <ul>
              {sessions.map((session, index) => <li key={session.id}>Séance {index + 1} · {careSessionTime(session)} · {sessionStatusLabels[session.status]}{session.notes ? ` · ${session.notes}` : ""}</li>)}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
