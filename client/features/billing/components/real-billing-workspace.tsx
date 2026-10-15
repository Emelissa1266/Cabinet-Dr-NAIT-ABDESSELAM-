"use client";

import { openPrivatePdf } from "@/lib/private-pdf";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { InvoiceEditor } from "./invoice-editor";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { ModuleSummary } from "@/components/ui/module-summary";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import { listPatients } from "@/features/patients/services/patient-service";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import styles from "./real-billing-workspace.module.css";
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
  toIsoFromLocalInput,
} from "../services/billing-display";
import {
  allocatePayment,
  cancelInvoice,
  cancelPayment,
  completePayment,
  deleteInvoice,
  createInvoiceItem,
  createPayment,
  filenameFromDisposition,
  getInvoiceSummary,
  getInvoicePdf,
  getInvoicePrintPdf,
  issueInvoice,
  listBillableServices,
  listInvoices,
  listPayments,
  listReceipts,
} from "../services/billing-api-service";

async function allPages<T>(fetchPage: (page: number) => Promise<{ results: T[]; next: string | null }>) {
  let page = 1;
  const results: T[] = [];
  let response;
  do { response = await fetchPage(page++); results.push(...response.results); } while (response.next);
  return { results };
}

function ActionIcon({ kind }: { kind: "edit" | "delete" }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{kind === "edit" ? <path d="m16 3 5 5-13 13H3v-5L16 3ZM13 6l5 5" /> : <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />}</svg>;
}

const invoiceStatuses: Array<InvoiceStatus | ""> = ["", "DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"];
const paymentMethods = Object.keys(paymentMethodLabels) as PaymentMethod[];

function invoiceLabel(invoice: InvoiceApi) {
  return invoice.invoice_number ?? "Brouillon non émis";
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
  const canManageInvoices = user?.role === "ADMIN" || user?.role === "SECRETARY" || user?.role === "DOCTOR" || user?.role === "NURSE";
  const canManagePayments = user?.role === "ADMIN" || user?.role === "SECRETARY";
  const [invoices, setInvoices] = useState<InvoiceApi[]>([]);
  const [summary, setSummary] = useState({ total: "0.00", paid: "0.00", remaining: "0.00" });
  const [hasNext, setHasNext] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [payments, setPayments] = useState<PaymentApi[]>([]);
  const [receipts, setReceipts] = useState<ReceiptApi[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<BillableServiceApi[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(initialInvoiceId && /^\d+$/.test(initialInvoiceId) ? Number(initialInvoiceId) : null);
  const [editing, setEditing] = useState<InvoiceApi | null>(null);
  const [deleting, setDeleting] = useState<InvoiceApi | null>(null);
  const [creating, setCreating] = useState(create);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0] ?? null;

  const load = useCallback(async () => {
    const [invoicePage, patientPage, servicePage, totals] = await Promise.all([
      listInvoices({ page, search: query, status, patient: initialPatientId, ordering: "-issue_date,-created_at" }),
      canManageInvoices ? allPages((page) => listPatients({ page, ordering: "last_name" })) : Promise.resolve({ count: 0, next: null, previous: null, results: [] }),
      canManageInvoices ? allPages((page) => listBillableServices({ page, is_active: true })) : Promise.resolve({ count: 0, next: null, previous: null, results: [] }),
      getInvoiceSummary({ search: query, status, patient: initialPatientId }),
    ]);
    setSummary(totals);
    setHasNext(Boolean(invoicePage.next));
    if (invoicePage.results.length && (invoicePage.next || page === 1)) setPageSize(invoicePage.results.length);
    setInvoices(invoicePage.results);
    setInvoiceCount(invoicePage.count);
    setPatients(patientPage.results);
    setServices(servicePage.results);
    setSelectedId((current) => invoicePage.results.find((invoice) => invoice.id === current)?.id ?? invoicePage.results[0]?.id ?? null);
  }, [canManageInvoices, initialPatientId, page, query, status]);

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
      if (invoices.length === 1 && page > 1 && deleting) { setPage(value => value - 1); setMessage(success); }
      else await refresh(success);
    } catch (cause) {
      setError(billingErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(invoice: InvoiceApi) {
    await run(async () => {
      const response = await getInvoicePdf(invoice.id);
      const url = window.URL.createObjectURL(response.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromDisposition(
        response.headers.get("content-disposition"),
        `${invoice.invoice_number ?? "facture"}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }, "PDF de facture téléchargé.");
  }

  async function printPdf(invoice: InvoiceApi) {
    await run(() => openPrivatePdf(() => getInvoicePrintPdf(invoice.id), true), "Document prêt pour impression.");
  }

  const pages = Math.max(1, Math.ceil(invoiceCount / pageSize));

  if (ready && user && !["ADMIN", "SECRETARY", "DOCTOR", "NURSE"].includes(user.role)) {
    return <main className={ui.page}><section className={ui.panel}><h1>Facturation</h1><p>La facturation n’est pas disponible pour votre rôle.</p></section></main>;
  }

  return (
    <main className={`${ui.page} ${styles.billingPage}`}>
      <header className={ui.heading}>
        <div><p className={ui.eyebrow}>{user?.role === "NURSE" ? "Facturation des soins" : "Finances du cabinet"}</p><h1 className={ui.title}>Facturation</h1><p className={ui.description}>{user?.role === "NURSE" ? "Gestion des factures liées aux soins infirmiers." : "Factures, paiements, allocations et reçus du cabinet."}</p></div>
        {canManageInvoices && <button className={`${ui.action} ${ui.primary}`} onClick={() => setCreating(true)}>+ Ajouter une facture</button>}
      </header>
      <ModuleSummary items={[
        { label: "Total émis", value: money(summary.total, "DZD") },
        { label: "Déjà payé", value: money(summary.paid, "DZD") },
        { label: "Solde", value: money(summary.remaining, "DZD") },
      ]} />
      {error && <p className={ui.panel} role="alert">{error}</p>}
      {message && <p className={ui.panel} role="status">{message}</p>}
      <div className={`${ui.toolbar} ${styles.filters}`}>
        <label className={ui.search}>Recherche<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Facture, patient..." /></label>
        <select value={status} onChange={(event) => { setStatus(event.target.value as InvoiceStatus | ""); setPage(1); }} aria-label="Statut facture">
          {invoiceStatuses.map((item) => <option key={item || "all"} value={item}>{item ? invoiceStatusLabels[item] : "Tous les statuts"}</option>)}
        </select>
      </div>
      {loading ? <p className={ui.panel} role="status">Chargement de la facturation...</p> : error && !invoices.length ? (
        <p className={ui.panel}>Impossible de charger la facturation.</p>
      ) : (
        <div className={styles.billingLayout}>
          <section className={`${ui.tableScroll} ${styles.invoiceList}`}>
            <table className={`${ui.table} ${styles.invoiceTable}`}>
              <thead><tr><th>Facture</th><th>Patient</th><th>Date</th><th>Échéance</th><th>Total</th><th>Payé</th><th>Solde</th><th>Statut</th></tr></thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} onClick={() => setSelectedId(invoice.id)} aria-selected={invoice.id === selected?.id}>
                    <td><strong>{invoiceLabel(invoice)}</strong></td>
                    <td><span>{invoice.patient_name}</span></td>
                    <td>{dateOnly(invoice.issue_date)}</td>
                    <td>{dateOnly(invoice.due_date)}</td>
                    <td>{money(invoice.total, invoice.currency)}</td>
                    <td>{money(invoice.paid_amount, invoice.currency)}</td>
                    <td>{money(invoice.remaining_amount, invoice.currency)}</td>
                    <td><StatusBadge tone={invoiceTone(invoice.status)}>{invoiceStatusLabels[invoice.status]}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!invoices.length && <p className={ui.empty}>Aucune facture trouvée.</p>}
            <footer className={ui.footer}><span>{invoiceCount} factures</span><div className={ui.actions}><button className={ui.action} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Précédent</button><span>{page} / {pages}</span><button className={ui.action} disabled={!hasNext} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Suivant</button></div></footer>
          </section>
          {selected && <aside className={`${ui.panel} ${styles.invoiceDetail}`}>
            <div className={styles.detailHeader}><div><p className={ui.eyebrow}>Détail facture</p><h2>{invoiceLabel(selected)}</h2></div><StatusBadge tone={invoiceTone(selected.status)}>{invoiceStatusLabels[selected.status]}</StatusBadge></div>
            <dl className={styles.metaList}><dt>Patient</dt><dd>{selected.patient_name}</dd><dt>Date</dt><dd>{dateOnly(selected.issue_date)}</dd><dt>Échéance</dt><dd>{dateOnly(selected.due_date)}</dd></dl>
            <dl className={styles.financialSummary}><div><dt>Total</dt><dd>{money(selected.total, selected.currency)}</dd></div><div><dt>Payé</dt><dd>{money(selected.paid_amount, selected.currency)}</dd></div><div><dt>Solde</dt><dd>{money(selected.remaining_amount, selected.currency)}</dd></div></dl>
            <div className={ui.actions}>
              {canManageInvoices && <button className={ui.action} disabled={busy || !selected.can_edit} onClick={() => setEditing(selected)}><ActionIcon kind="edit" /> Modifier</button>}
              {canManageInvoices && <button className={ui.action} disabled={busy || !selected.can_delete} onClick={() => setDeleting(selected)}><ActionIcon kind="delete" /> Supprimer</button>}
              <Link className={ui.action} href={`/patients/${selected.patient_reference}`}>Dossier patient</Link>
              {selected.status !== "DRAFT" && <button className={ui.action} disabled={busy} onClick={() => downloadPdf(selected)}>Télécharger PDF</button>}
              {selected.status !== "DRAFT" && <button className={ui.action} disabled={busy} onClick={() => run(() => openPrivatePdf(() => getInvoicePrintPdf(selected.id)), "Aperçu de la facture ouvert.")}>Voir la facture</button>}
              {selected.status !== "DRAFT" && <button className={ui.action} disabled={busy} onClick={() => printPdf(selected)}>Imprimer</button>}
              {canManageInvoices && selected.status === "DRAFT" && <button className={ui.action} disabled={busy} onClick={() => run(() => issueInvoice(selected.id), "Facture émise.")}>Émettre</button>}
              {canManagePayments && !["PAID", "CANCELLED"].includes(selected.status) && selected.status !== "DRAFT" && <button className={`${ui.action} ${ui.primary}`} disabled={busy || selected.remaining_amount === "0.00"} onClick={() => setMessage("")}>Paiement ci-dessous</button>}
              {canManageInvoices && ["DRAFT", "ISSUED"].includes(selected.status) && <button className={ui.action} disabled={busy} onClick={() => { const reason = window.prompt("Motif d’annulation"); if (reason) void run(() => cancelInvoice(selected.id, reason), "Facture annulée."); }}>Annuler</button>}
            </div>
            <section className={styles.section}><h3>Lignes de facture</h3>{selected.items.length ? <ul className={styles.lineList}>{selected.items.map((item) => <li key={item.id}><strong>{item.description}</strong><dl><dt>Quantité</dt><dd>{item.quantity}</dd><dt>Prix unitaire</dt><dd>{money(item.unit_price, selected.currency)}</dd><dt>Remise</dt><dd>{money(item.discount_amount, selected.currency)}</dd><dt>Sous-total</dt><dd>{money(item.net_amount, selected.currency)}</dd></dl></li>)}</ul> : <p>Aucune ligne.</p>}</section>
            {canManageInvoices && selected.can_edit && <AddItemForm invoice={selected} services={services} onDone={() => refresh("Ligne ajoutée.")} />}
            {canManagePayments && selected.status !== "DRAFT" && selected.status !== "CANCELLED" && selected.remaining_amount !== "0.00" && <section className={styles.section}><h3>Encaissement</h3><PaymentForm invoice={selected} onDone={() => refresh("Paiement enregistré, alloué et comptabilisé.")} /></section>}
            <section className={styles.section}><h3>Paiements</h3>{payments.filter((payment) => payment.allocations.some((allocation) => allocation.invoice === selected.id)).map((payment) => <p key={payment.id}>{payment.payment_number} · {paymentStatusLabels[payment.status]} · {money(payment.amount, payment.currency)} · {paymentMethodLabels[payment.payment_method]} {canManagePayments && payment.status !== "CANCELLED" && <button className={styles.link} disabled={busy} onClick={() => { const reason = window.prompt("Motif d’annulation du paiement"); if (reason) void run(() => cancelPayment(payment.id, reason), "Paiement annulé."); }}>Annuler</button>}</p>)}{!payments.some((payment) => payment.allocations.some((allocation) => allocation.invoice === selected.id)) && <p>Aucun paiement enregistré.</p>}</section>
            <section className={styles.section}><h3>Reçus</h3>{receipts.filter((receipt) => receipt.allocations.some((allocation) => allocation.invoice === selected.id)).map((receipt) => <p key={receipt.id}>{receipt.receipt_number} · {dateTime(receipt.issued_at)} · {money(receipt.payment_amount, "DZD")}</p>)}{!receipts.some((receipt) => receipt.allocations.some((allocation) => allocation.invoice === selected.id)) && <p>Aucun reçu disponible.</p>}</section>
          </aside>}
        </div>
      )}
      <DetailDialog title="Nouvelle facture" open={canManageInvoices && creating} onClose={() => setCreating(false)}>
        {creating && <InvoiceEditor patients={patients} services={services} initialPatientId={initialPatientId} onCancel={() => setCreating(false)} onSave={async (id) => { setCreating(false); setSelectedId(id); await refresh("Brouillon de facture créé."); }} />}
      </DetailDialog>
      <DetailDialog title="Modifier la facture" open={Boolean(editing)} onClose={() => setEditing(null)}>
        {editing && <InvoiceEditor invoice={editing} patients={patients} services={services} onCancel={() => setEditing(null)} onSave={async (id, emitted) => { setEditing(null); setSelectedId(id); await refresh(emitted ? "Facture émise." : "Facture modifiée."); }} />}
      </DetailDialog>
      <DetailDialog title="Supprimer la facture" open={Boolean(deleting)} onClose={() => { if (!busy) setDeleting(null); }}>
        <p>Voulez-vous vraiment supprimer cette facture ? Cette action est irréversible.</p>
        {error && <p role="alert">{error}</p>}
        <div className={ui.actions}>
          <button className={`${ui.action} ${ui.primary}`} disabled={busy} onClick={() => { if (deleting) void run(async () => { await deleteInvoice(deleting.id); setDeleting(null); }, "Facture supprimée."); }}>{busy ? "Suppression..." : "Supprimer"}</button>
          <button className={ui.action} disabled={busy} onClick={() => setDeleting(null)}>Annuler</button>
        </div>
      </DetailDialog>
    </main>
  );
}
