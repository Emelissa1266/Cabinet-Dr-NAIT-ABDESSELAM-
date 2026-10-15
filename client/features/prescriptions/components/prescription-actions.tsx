"use client";

import { useState } from "react";
import { medicalErrorMessage } from "@/features/medical/services/medical-errors";
import { downloadPrescriptionPdf, previewPrescriptionPdf } from "../services/prescription-pdf";
import ui from "@/components/ui/clinical.module.css";

export function PrescriptionActions({ id, onView }: { id: number; onView?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try { await action(); setMessage(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : medicalErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <div>
    <div className={ui.actions}>
      <button className={ui.action} disabled={busy} onClick={() => onView ? onView() : void run(() => previewPrescriptionPdf(id), "Aperçu de l’ordonnance ouvert.")}>Voir l’ordonnance</button>
      <button className={ui.action} disabled={busy} onClick={() => void run(() => downloadPrescriptionPdf(id), "PDF de l’ordonnance téléchargé.")}>Télécharger PDF</button>
      <button className={ui.action} disabled={busy} onClick={() => void run(() => previewPrescriptionPdf(id, true), "Aperçu d’impression ouvert.")}>Imprimer</button>
    </div>
    {busy && <p role="status">Préparation du PDF…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
