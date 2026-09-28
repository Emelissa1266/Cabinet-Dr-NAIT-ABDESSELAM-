import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatAmount,formatDate } from "@/lib/clinical-format";
import { invoiceBalance,invoiceTotal,type Invoice } from "../types";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";
export function InvoiceDetails({ invoice,patient }: { invoice:Invoice;patient:string }) {
 return <div className={styles.stack}><div><h3>{invoice.id}</h3><p>{patient}</p><div className={ui.actions}><StatusBadge tone="neutral">{invoice.status}</StatusBadge><StatusBadge tone={invoice.paymentStatus==="Payée"?"success":invoice.paymentStatus==="Partielle"?"warning":"neutral"}>{invoice.paymentStatus}</StatusBadge></div></div>
 <dl><dt>Date</dt><dd>{formatDate(invoice.date)}</dd><dt>Échéance</dt><dd>{formatDate(invoice.dueDate)}</dd></dl>
 <section className={styles.section}><h3>Prestations</h3><ul className={styles.list}>{invoice.lines.map(line=><li key={line.id}><strong>{line.description}</strong><small>{line.kind} · {line.quantity} × {formatAmount(line.unitPrice)}</small><p>{formatAmount(line.quantity*line.unitPrice)}</p>{line.treatmentId&&<small>Programme {line.treatmentId}{line.sessionId?` · Séance ${line.sessionId}`:""}</small>}</li>)}</ul></section>
 <dl><dt>Total</dt><dd>{formatAmount(invoiceTotal(invoice))}</dd><dt>Déjà réglé</dt><dd>{formatAmount(invoice.paidAmount)}</dd><dt>{invoice.status==="Brouillon"?"Solde prévisionnel":"Reste à régler"}</dt><dd>{formatAmount(invoiceBalance(invoice))}</dd></dl>
 <section className={styles.section}><h3>Historique de la facture</h3><ol className={styles.list}>{invoice.history.map((event,index)=><li key={index}><strong>{event.label}</strong><small>{formatDate(event.date)}</small></li>)}</ol></section><p>{invoice.notes}</p>
 <div className={ui.actions}><Link className={ui.action} href={`/patients/${invoice.patientId}`}>Dossier patient</Link>{invoice.lines.some(l=>l.treatmentId)&&<Link className={ui.action} href="/care">Programmes de soins</Link>}<button className={ui.action} disabled title="La génération de documents sera activée ultérieurement">Générer la facture</button></div>
 </div>;
}
