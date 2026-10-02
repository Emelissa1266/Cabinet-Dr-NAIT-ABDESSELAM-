"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAppointments } from "@/features/agenda/services/agenda-service";
import type { Appointment } from "@/features/agenda/types";
import type { Patient } from "../types";
import { patientAppointmentHref, patientAppointmentSummary } from "../services/patient-appointments";
import ui from "@/components/ui/clinical.module.css";
import styles from "./patient-detail.module.css";

function tone(status: Appointment["status"]) {
  if (status === "CANCELLED" || status === "NO_SHOW") return "error";
  if (status === "SCHEDULED") return "warning";
  if (status === "COMPLETED") return "success";
  return "teal";
}

export function PatientAppointmentsSection({ patient, basePath }: { patient: Patient; basePath: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await listAppointments({ patient: patient.apiId, ordering: "-start_at" });
      setAppointments(page.results);
    } catch {
      setAppointments([]);
      setError("Impossible de charger les rendez-vous.");
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

  return (
    <section className={`${ui.panel} ${styles.next}`}>
      <p className={ui.eyebrow}>Rendez-vous</p>
      <h2>Rendez-vous du patient</h2>
      {loading && <p role="status">Chargement des rendez-vous…</p>}
      {!loading && error && <p role="alert">{error}</p>}
      {!loading && !error && !appointments.length && <p>Aucun rendez-vous pour ce patient.</p>}
      {!loading && !error && appointments.length > 0 && (
        <div className={styles.appointments}>
          {appointments.map((appointment) => {
            const summary = patientAppointmentSummary(appointment);
            return (
              <article className={styles.appointment} key={appointment.id}>
                <div>
                  <strong>{summary.title}</strong>
                  <p>{summary.dateTime}</p>
                  <p>{summary.staff}</p>
                  <p>{summary.reason}</p>
                </div>
                <div className={styles.appointmentActions}>
                  <StatusBadge tone={tone(appointment.status)}>{summary.status}</StatusBadge>
                  <Link className={ui.action} href={patientAppointmentHref(basePath, appointment)}>Ouvrir l’agenda</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
