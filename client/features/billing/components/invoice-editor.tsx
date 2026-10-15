"use client";

import { useState } from "react";
import type { Patient } from "@/features/patients/types";
import type { BillableServiceApi, InvoiceApi, InvoiceFormLine } from "../api-types";
import { createInvoice, updateInvoice } from "../services/billing-api-service";
import { billingErrorMessage, money, todayKey } from "../services/billing-display";
import { invoicePreview } from "../services/invoice-form";
import ui from "@/components/ui/clinical.module.css";
import styles from "./real-billing-workspace.module.css";

export function InvoiceEditor({ invoice, patients, services, initialPatientId, onCancel, onSave }: {
  invoice?: InvoiceApi; patients: Patient[]; services: BillableServiceApi[]; initialPatientId?: string;
  onCancel: () => void; onSave: (id: number, emitted: boolean) => Promise<void>;
}) {
  const blank = (): InvoiceFormLine => ({ description: "", quantity: "1.00", unit_price: "0.00", discount_amount: "0.00" });
  const [patient, setPatient] = useState(invoice?.patient || Number(initialPatientId) || patients[0]?.apiId || 0);
  const [lines, setLines] = useState<InvoiceFormLine[]>(invoice?.items.map(item => ({
    id: item.id, billable_service: item.billable_service, description: item.description,
    quantity: item.quantity, unit_price: item.unit_price, discount_amount: item.discount_amount,
  })) ?? [blank()]);
  const [discount, setDiscount] = useState(invoice?.discount_amount ?? "0.00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  let total = "0.00", previewError = "";
  try { total = invoicePreview(lines, discount); } catch (cause) { previewError = (cause as Error).message; }
  function change(index: number, data: Partial<InvoiceFormLine>) {
    setLines(current => current.map((line, i) => i === index ? { ...line, ...data } : line));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (previewError) { setError(previewError); return; }
    const form = new FormData(event.currentTarget);
    const emit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "issue";
    setBusy(true); setError("");
    try {
      const payload = { patient, lines, emit, discount_amount: discount,
        issue_date: String(form.get("issue_date")), due_date: String(form.get("due_date") || "") || null,
        notes: String(form.get("notes") || ""), internal_notes: String(form.get("internal_notes") || "") };
      const result = invoice ? await updateInvoice(invoice.id, payload) : await createInvoice(payload);
      await onSave(result.id, emit);
    } catch (cause) { setError(billingErrorMessage(cause)); } finally { setBusy(false); }
  }
  return <form className={ui.form} onSubmit={submit}>
    <fieldset disabled={busy} className={styles.editorFields}>
      <label>Patient<select required value={patient || ""} onChange={event => setPatient(Number(event.target.value))}>
        <option value="" disabled>Sélectionner un patient</option>
        {invoice && !patients.some(p => p.apiId === invoice.patient) && <option value={invoice.patient}>{invoice.patient_name}</option>}
        {patients.map(p => <option key={p.apiId} value={p.apiId}>{p.name}</option>)}
      </select></label>
      {lines.map((line, index) => <section className={styles.section} key={line.id ?? `new-${index}`} aria-label={`Prestation ${index + 1}`}>
        <label>Prestation {index + 1}<select value={line.billable_service ?? ""} onChange={event => {
          const service = services.find(s => s.id === Number(event.target.value));
          change(index, { billable_service: service?.id ?? null, ...(service ? { description: service.name, unit_price: service.default_unit_price } : {}) });
        }}>
          <option value="">Prestation personnalisée</option>
          {line.billable_service && !services.some(s => s.id === line.billable_service) && <option value={line.billable_service}>{invoice?.items.find(i => i.id === line.id)?.billable_service_name ?? "Prestation archivée"}</option>}
          {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select></label>
        <label>Description<input required maxLength={255} value={line.description ?? ""} onChange={event => change(index, { description: event.target.value })} /></label>
        <div className={styles.editorGrid}>
          <label>Quantité<input type="number" min="0.01" step="0.01" required value={line.quantity} onChange={event => change(index, { quantity: event.target.value })} /></label>
          <label>Prix unitaire (DZD)<input type="number" min="0" step="0.01" required value={line.unit_price} onChange={event => change(index, { unit_price: event.target.value })} /></label>
          <label>Remise ligne (DZD)<input type="number" min="0" step="0.01" required value={line.discount_amount} onChange={event => change(index, { discount_amount: event.target.value })} /></label>
        </div>
        <button type="button" className={ui.action} disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Retirer la prestation {index + 1}</button>
      </section>)}
      <button type="button" className={ui.action} onClick={() => setLines(current => [...current, blank()])}>+ Ajouter une prestation</button>
      <div className={styles.editorGrid}>
        <label>Date facture<input type="date" name="issue_date" required defaultValue={invoice?.issue_date ?? todayKey()} /></label>
        <label>Échéance (facultative)<input type="date" name="due_date" defaultValue={invoice?.due_date ?? ""} /></label>
        <label>Remise facture (DZD)<input type="number" min="0" step="0.01" required value={discount} onChange={event => setDiscount(event.target.value)} /></label>
      </div>
      <label>Notes patient<textarea name="notes" defaultValue={invoice?.notes} /></label>
      <label>Notes internes<textarea name="internal_notes" defaultValue={invoice?.internal_notes} /></label>
      <p aria-live="polite">Total : <strong>{previewError ? "—" : money(total, "DZD")}</strong></p>
      {previewError && <p role="alert">{previewError}</p>}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className={ui.actions}>
      <button className={`${ui.action} ${ui.primary}`} value="draft" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer le brouillon"}</button>
      <button className={ui.action} value="issue" disabled={busy}>Enregistrer et émettre</button>
      <button className={ui.action} type="button" disabled={busy} onClick={onCancel}>Annuler</button>
    </div>
  </form>;
}
