"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { ModuleSummary } from "@/components/ui/module-summary";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import { listPatients } from "@/features/patients/services/patient-service";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";
import type { BillableServiceApi, InvoiceApi, InvoiceStatus, PaymentApi, PaymentMethod, ReceiptApi } from "../api-types";
import {
  billingErrorMessage,
  dateOnly,
  dateTime,
  invoiceStatusLabels,
  invoiceTone,
  localDateTimeInput,
  money,
  paymentMethodLabels,
  paymentStatusLabels,
  todayKey,
  toIsoFromLocalInput,
} from "../services/billing-display";
import {
  allocatePayment,
  cancelInvoice,
  cancelPayment,
  completePayment,
  createInvoice,
  createInvoiceItem,
  createPayment,
  issueInvoice,
  listBillableServices,
  listInvoices,
  listPayments,
  listReceipts,
} from "../services/billing-api-service";

const invoiceStatuses: Array<InvoiceStatus | ""> = ["", "DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"];
const paymentMethods = Object.keys(paymentMethodLabels) as PaymentMethod[];

function patientLabel(patient: Patient) {
  return `${patient.name} · ${patient.patientReference}`;
}

function invoiceLabel(invoice: InvoiceApi) {
  return invoice.invoice_number ?? `Brouillon #${invoice.id}`;
}

function RealInvoiceForm({
  patients,
  services,
  initialPatientId,
  onCancel,
  onSave,
}: {
  patients: Patient[];
  services: BillableServiceApi[];
  initialPatientId?: string;
  onCancel: () => void;
  onSave: (invoiceId: number) => Promise<void>;
}) {
  const [patientId, setPatientId] = useState(Number(initialPatientId) || patients[0]?.apiId || 0);
  const [serviceId, setServiceId] = useState(services[0]?.id || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const service = services.find((item) => item.id === serviceId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!patientId) {
      setError("Sélectionnez un patient.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const invoice = await createInvoice({
        patient: patientId,
        issue_date: String(form.get("issue_date") || todayKey()),
        due_date: String(form.get("due_date") || "") || null,
        discount_amount: String(form.get("invoice_discount") || "0.00"),
        notes: String(form.get("notes") || "").trim(),
        internal_notes: String(form.get("internal_notes") || "").trim(),
      });
      await createInvoiceItem({
        invoice: invoice.id,
        billable_service: serviceId || null,
        description: String(form.get("description") || service?.name || "").trim() || undefined,
        quantity: String(form.get("quantity") || "1.00"),
        unit_price: String(form.get("unit_price") || service?.default_unit_price || "0.00"),
        discount_amount: String(form.get("line_discount") || "0.00"),
      });
      await onSave(invoice.id);
    } catch (cause) {
      setError(billingErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={ui.form} onSubmit={submit}>
      <label>Patient
        <select value={patientId || ""} onChange={(event) => setPatientId(Number(event.target.value))} required>
          <option value="" disabled>Sélectionner un patient</option>
          {patients.map((patient) => <option key={patient.apiId} value={patient.apiId}>{patientLabel(patient)}</option>)}
        </select>
      </label>
      <label>Prestation
        <select value={serviceId || ""} onChange={(event) => setServiceId(Number(event.target.value))}>
          <option value="">Prestation personnalisée</option>
          {services.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.default_unit_price, item.currency)}</option>)}
        </select>
      </label>
      <label>Description<input name="description" defaultValue={service?.name ?? ""} maxLength={255} /></label>
      <div className={ui.toolbar}>
        <label>Quantité<input name="quantity" inputMode="decimal" defaultValue="1.00" required /></label>
        <label>Prix unitaire<input name="unit_price" inputMode="decimal" defaultValue={service?.default_unit_price ?? "0.00"} required /></label>
        <label>Remise ligne<input name="line_discount" inputMode="decimal" defaultValue="0.00" /></label>
      </div>
      <div className={ui.toolbar}>
        <label>Date facture<input name="issue_date" type="date" defaultValue={todayKey()} required /></label>
        <label>Échéance<input name="due_date" type="date" /></label>
        <label>Remise facture<input name="invoice_discount" inputMode="decimal" defaultValue="0.00" /></label>
      </div>
      <label>Notes patient<textarea name="notes" /></label>
      <label>Notes internes<textarea name="internal_notes" /></label>
      {error && <p role="alert">{error}</p>}
      <div className={ui.actions}>
        <button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Création..." : "Créer le brouillon"}</button>
        <button className={ui.action} type="button" disabled={busy} onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function AddItemForm({ invoice, services, onDone }: { invoice: InvoiceApi; services: BillableServiceApi[]; onDone: () => Promise<void> }) {
  const [serviceId, setServiceId] = useState(services[0]?.id || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const service = services.find((item) => item.id === serviceId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await createInvoiceItem({
        invoice: invoice.id,
        billable_service: serviceId || null,
        description: String(form.get("description") || service?.name || "").trim() || undefined,
        quantity: String(form.get("quantity") || "1.00"),
        unit_price: String(form.get("unit_price") || service?.default_unit_price || "0.00"),
        discount_amount: String(form.get("discount_amount") || "0.00"),
      });
      await onDone();
      event.currentTarget.reset();
    } catch (cause) {
      setError(billingErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={ui.form} onSubmit={submit}>
      <label>Prestation<select value={serviceId || ""} onChange={(event) => setServiceId(Number(event.target.value))}><option value="">Personnalisée</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Description<input name="description" defaultValue={service?.name ?? ""} /></label>
      <div className={ui.toolbar}><label>Quantité<input name="quantity" defaultValue="1.00" /></label><label>Prix<input name="unit_price" defaultValue={service?.default_unit_price ?? "0.00"} /></label><label>Remise<input name="discount_amount" defaultValue="0.00" /></label></div>
      {error && <p role="alert">{error}</p>}
      <button className={ui.action} disabled={busy}>Ajouter ligne</button>
    </form>
  );
}

function PaymentForm({ invoice, onDone }: { invoice: InvoiceApi; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = String(form.get("amount") || invoice.remaining_amount);
    setBusy(true);
    setError("");
    try {
      const payment = await createPayment({
        patient: invoice.patient,
        amount,
        payment_method: String(form.get("payment_method")) as PaymentMethod,
        paid_at: toIsoFromLocalInput(form.get("paid_at")),
        reference: String(form.get("reference") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
      });
      await allocatePayment(payment.id, invoice.id, amount);
      await completePayment(payment.id);
      await onDone();
      event.currentTarget.reset();
    } catch (cause) {
      setError(billingErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={ui.form} onSubmit={submit}>
      <div className={ui.toolbar}>
        <label>Montant<input name="amount" inputMode="decimal" defaultValue={invoice.remaining_amount} required /></label>
        <label>Mode<select name="payment_method" defaultValue="CASH">{paymentMethods.map((method) => <option key={method} value={method}>{paymentMethodLabels[method]}</option>)}</select></label>
        <label>Date<input name="paid_at" type="datetime-local" defaultValue={localDateTimeInput()} /></label>
      </div>
      <label>Référence<input name="reference" /></label>
      <label>Notes<textarea name="notes" /></label>
      {error && <p role="alert">{error}</p>}
      <button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Encaissement..." : "Enregistrer, allouer et comptabiliser"}</button>
    </form>
  );
}

export function RealBillingWorkspace({ initialPatientId, initialInvoiceId, create = false }: { initialPatientId?: string; initialInvoiceId?: string; create?: boolean }) {
  const { user, ready } = useAuth();
  const canWrite = user?.role === "ADMIN" || user?.role === "SECRETARY";
  const [invoices, setInvoices] = useState<InvoiceApi[]>([]);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [payments, setPayments] = useState<PaymentApi[]>([]);
  const [receipts, setReceipts] = useState<ReceiptApi[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<BillableServiceApi[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(initialInvoiceId && /^\d+$/.test(initialInvoiceId) ? Number(initialInvoiceId) : null);
  const [creating, setCreating] = useState(create);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0] ?? null;

  const load = useCallback(async () => {
    const [invoicePage, patientPage, servicePage] = await Promise.all([
      listInvoices({ page, search: query, status, patient: initialPatientId, ordering: "-issue_date" }),
      listPatients({ ordering: "last_name" }),
      listBillableServices({ is_active: true }),
    ]);
    setInvoices(invoicePage.results);
    setInvoiceCount(invoicePage.count);
    setPatients(patientPage.results);
    setServices(servicePage.results);
    setSelectedId((current) => invoicePage.results.find((invoice) => invoice.id === current)?.id ?? invoicePage.results[0]?.id ?? null);
  }, [initialPatientId, page, query, status]);

  const loadFinancials = useCallback(async (invoice: InvoiceApi | null) => {
    if (!invoice) {
      setPayments([]);
      setReceipts([]);
      return;
    }
    const [paymentPage, receiptPage] = await Promise.all([
      listPayments({ patient: invoice.patient, ordering: "-paid_at" }),
      listReceipts({ patient: invoice.patient, ordering: "-issued_at" }),
    ]);
    setPayments(paymentPage.results);
    setReceipts(receiptPage.results);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const timer = window.setTimeout(() => {
      load()
        .catch((cause) => {
          if (active) setError(billingErrorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [load, ready]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      loadFinancials(selected).catch((cause) => {
        if (active) setError(billingErrorMessage(cause));
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadFinancials, selected]);

  async function refresh(messageText?: string) {
    await load();
    if (selected) await loadFinancials(selected);
    if (messageText) setMessage(messageText);
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh(success);
    } catch (cause) {
      setError(billingErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const issued = invoices.filter((invoice) => invoice.status !== "DRAFT" && invoice.status !== "CANCELLED");
  const pages = Math.max(1, Math.ceil(invoiceCount / 10));

  if (ready && user && !["ADMIN", "SECRETARY", "DOCTOR", "NURSE"].includes(user.role)) {
    return <main className={ui.page}><section className={ui.panel}><h1>Facturation</h1><p>La facturation n’est pas disponible pour votre rôle.</p></section></main>;
  }

  return (
    <main className={ui.page}>
      <header className={ui.heading}>
        <div><p className={ui.eyebrow}>Finance cabinet</p><h1 className={ui.title}>Facturation</h1><p className={ui.description}>Factures, paiements, allocations et reçus réels du backend.</p></div>
        {canWrite && <button className={`${ui.action} ${ui.primary}`} onClick={() => setCreating(true)}>Nouvelle facture</button>}
      </header>
      <ModuleSummary items={[
        { label: "Total émis", value: money(issued.reduce((sum, invoice) => sum + Number(invoice.total), 0).toFixed(2), "DZD") },
        { label: "Déjà payé", value: money(issued.reduce((sum, invoice) => sum + Number(invoice.paid_amount), 0).toFixed(2), "DZD") },
        { label: "Solde", value: money(issued.reduce((sum, invoice) => sum + Number(invoice.remaining_amount), 0).toFixed(2), "DZD") },
      ]} />
      {error && <p className={ui.panel} role="alert">{error}</p>}
      {message && <p className={ui.panel} role="status">{message}</p>}
      <div className={ui.toolbar}>
        <label className={ui.search}>Recherche<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Facture, patient..." /></label>
        <select value={status} onChange={(event) => { setStatus(event.target.value as InvoiceStatus | ""); setPage(1); }} aria-label="Statut facture">
          {invoiceStatuses.map((item) => <option key={item || "all"} value={item}>{item ? invoiceStatusLabels[item] : "Tous les statuts"}</option>)}
        </select>
      </div>
      {loading ? <p className={ui.panel} role="status">Chargement de la facturation...</p> : (
        <div className={ui.toolbar}>
          <section className={ui.tableScroll}>
            <table className={ui.table}>
              <thead><tr><th>Facture</th><th>Patient</th><th>Total</th><th>Payé</th><th>Solde</th><th>Statut</th></tr></thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} onClick={() => setSelectedId(invoice.id)} aria-selected={invoice.id === selected?.id}>
                    <td><strong>{invoiceLabel(invoice)}</strong><small>{dateOnly(invoice.issue_date)} · échéance {dateOnly(invoice.due_date)}</small></td>
                    <td>{invoice.patient_name}<small>{invoice.patient_reference}</small></td>
                    <td>{money(invoice.total, invoice.currency)}</td>
                    <td>{money(invoice.paid_amount, invoice.currency)}</td>
                    <td>{money(invoice.remaining_amount, invoice.currency)}</td>
                    <td><StatusBadge tone={invoiceTone(invoice.status)}>{invoiceStatusLabels[invoice.status]}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!invoices.length && <p className={ui.empty}>Aucune facture trouvée.</p>}
            <footer className={ui.footer}><span>{invoiceCount} factures</span><div className={ui.actions}><button className={ui.action} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Précédent</button><span>{page} / {pages}</span><button className={ui.action} disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Suivant</button></div></footer>
          </section>
          {selected && <aside className={ui.panel}>
            <div className={ui.actions}><p className={ui.eyebrow}>Détail facture</p><StatusBadge tone={invoiceTone(selected.status)}>{invoiceStatusLabels[selected.status]}</StatusBadge></div>
            <h2>{invoiceLabel(selected)}</h2>
            <p>{selected.patient_name} · {selected.patient_reference}</p>
            <dl><dt>Total</dt><dd>{money(selected.total, selected.currency)}</dd><dt>Payé</dt><dd>{money(selected.paid_amount, selected.currency)}</dd><dt>Solde</dt><dd>{money(selected.remaining_amount, selected.currency)}</dd></dl>
            <div className={ui.actions}>
              <Link className={ui.action} href={`/patients/${selected.patient}`}>Dossier patient</Link>
              {canWrite && selected.status === "DRAFT" && <button className={ui.action} disabled={busy} onClick={() => run(() => issueInvoice(selected.id), "Facture émise.")}>Émettre</button>}
              {canWrite && !["PAID", "CANCELLED"].includes(selected.status) && selected.status !== "DRAFT" && <button className={`${ui.action} ${ui.primary}`} disabled={busy || selected.remaining_amount === "0.00"} onClick={() => setMessage("")}>Paiement ci-dessous</button>}
              {canWrite && ["DRAFT", "ISSUED"].includes(selected.status) && <button className={ui.action} disabled={busy} onClick={() => { const reason = window.prompt("Motif d’annulation"); if (reason) void run(() => cancelInvoice(selected.id, reason), "Facture annulée."); }}>Annuler</button>}
            </div>
            <section className={styles.section}><h3>Lignes</h3>{selected.items.length ? <ul className={styles.list}>{selected.items.map((item) => <li key={item.id}><strong>{item.description}</strong><small>{item.quantity} × {money(item.unit_price, selected.currency)} · remise {money(item.discount_amount, selected.currency)}</small><p>{money(item.net_amount, selected.currency)}</p></li>)}</ul> : <p>Aucune ligne.</p>}</section>
            {canWrite && selected.status === "DRAFT" && <AddItemForm invoice={selected} services={services} onDone={() => refresh("Ligne ajoutée.")} />}
            {canWrite && selected.status !== "DRAFT" && selected.status !== "CANCELLED" && selected.remaining_amount !== "0.00" && <section className={styles.section}><h3>Encaissement</h3><PaymentForm invoice={selected} onDone={() => refresh("Paiement enregistré, alloué et comptabilisé.")} /></section>}
            <section className={styles.section}><h3>Paiements</h3>{payments.filter((payment) => payment.allocations.some((allocation) => allocation.invoice === selected.id)).map((payment) => <p key={payment.id}>{payment.payment_number} · {paymentStatusLabels[payment.status]} · {money(payment.amount, payment.currency)} · {paymentMethodLabels[payment.payment_method]} {canWrite && payment.status !== "CANCELLED" && <button className={styles.link} disabled={busy} onClick={() => { const reason = window.prompt("Motif d’annulation du paiement"); if (reason) void run(() => cancelPayment(payment.id, reason), "Paiement annulé."); }}>Annuler</button>}</p>)}{!payments.some((payment) => payment.allocations.some((allocation) => allocation.invoice === selected.id)) && <p>Aucun paiement alloué.</p>}</section>
            <section className={styles.section}><h3>Reçus</h3>{receipts.filter((receipt) => receipt.allocations.some((allocation) => allocation.invoice === selected.id)).map((receipt) => <p key={receipt.id}>{receipt.receipt_number} · {dateTime(receipt.issued_at)} · {money(receipt.payment_amount, "DZD")}</p>)}{!receipts.some((receipt) => receipt.allocations.some((allocation) => allocation.invoice === selected.id)) && <p>Aucun reçu.</p>}</section>
          </aside>}
        </div>
      )}
      <DetailDialog title="Nouvelle facture" open={canWrite && creating} onClose={() => setCreating(false)}>
        {creating && <RealInvoiceForm patients={patients} services={services} initialPatientId={initialPatientId} onCancel={() => setCreating(false)} onSave={async (id) => { setCreating(false); setSelectedId(id); await refresh("Brouillon de facture créé."); }} />}
      </DetailDialog>
    </main>
  );
}
