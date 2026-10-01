"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import type { InvoiceApi, PatientFinancialSummaryApi, PaymentApi } from "../api-types";
import { billingErrorMessage, dateOnly, invoiceStatusLabels, invoiceTone, money, paymentMethodLabels, paymentStatusLabels } from "../services/billing-display";
import { getPatientFinancialSummary, listInvoices, listPayments } from "../services/billing-api-service";

export function PatientFinancialSection({ patient }: { patient: Patient }) {
  const [summary, setSummary] = useState<PatientFinancialSummaryApi | null>(null);
  const [invoices, setInvoices] = useState<InvoiceApi[]>([]);
  const [payments, setPayments] = useState<PaymentApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.all([
        getPatientFinancialSummary(patient.apiId),
        listInvoices({ patient: patient.apiId, ordering: "-issue_date" }),
        listPayments({ patient: patient.apiId, ordering: "-paid_at" }),
      ])
        .then(([financialSummary, invoicePage, paymentPage]) => {
          if (!active) return;
          setSummary(financialSummary);
          setInvoices(invoicePage.results);
          setPayments(paymentPage.results);
        })
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
  }, [patient.apiId]);

  if (loading) return <section className={ui.panel}><h2>Paiements</h2><p role="status">Chargement de la synthèse financière...</p></section>;
  if (error) return <section className={ui.panel}><h2>Paiements</h2><p role="alert">{error}</p></section>;

  return (
    <section className={ui.panel}>
      <div className={ui.heading}>
        <div>
          <h2>Paiements</h2>
          <p>Synthèse financière backend, factures et règlements réels.</p>
        </div>
        <Link className={ui.action} href={`/secretary/billing?patient=${patient.apiId}`}>Ouvrir facturation</Link>
      </div>
      {summary && <dl>
        <dt>Total facturé</dt><dd>{money(summary.total_invoiced)}</dd>
        <dt>Total payé</dt><dd>{money(summary.total_paid)}</dd>
        <dt>Solde</dt><dd>{money(summary.total_remaining)}</dd>
        <dt>Factures impayées / partielles</dt><dd>{summary.unpaid_invoices_count} / {summary.partially_paid_invoices_count}</dd>
      </dl>}
      <h3>Factures</h3>
      {invoices.length ? <div className={ui.tableScroll}><table className={ui.table}><thead><tr><th>Facture</th><th>Total</th><th>Solde</th><th>Statut</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number ?? `Brouillon #${invoice.id}`}<small>{dateOnly(invoice.issue_date)}</small></td><td>{money(invoice.total, invoice.currency)}</td><td>{money(invoice.remaining_amount, invoice.currency)}</td><td><StatusBadge tone={invoiceTone(invoice.status)}>{invoiceStatusLabels[invoice.status]}</StatusBadge></td></tr>)}</tbody></table></div> : <p>Aucune facture.</p>}
      <h3>Règlements</h3>
      {payments.length ? <ul>{payments.map((payment) => <li key={payment.id}>{payment.payment_number} · {paymentStatusLabels[payment.status]} · {money(payment.amount, payment.currency)} · {paymentMethodLabels[payment.payment_method]}</li>)}</ul> : <p>Aucun règlement.</p>}
    </section>
  );
}
