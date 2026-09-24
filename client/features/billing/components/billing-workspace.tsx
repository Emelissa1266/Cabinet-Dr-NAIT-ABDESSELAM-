"use client";
import { useState } from "react";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { ModuleSummary } from "@/components/ui/module-summary";
import type { Patient } from "@/features/patients/types";
import { formatAmount,formatDate } from "@/lib/clinical-format";
import { invoiceBalance,invoiceTotal,type Invoice } from "../types";
import { InvoiceDetails } from "./invoice-details";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";
export function BillingWorkspace({ invoices,patients }: { invoices:Invoice[];patients:Patient[] }) {
 const [query,setQuery]=useState("");const [payment,setPayment]=useState("");const [status,setStatus]=useState("");const [kind,setKind]=useState("");const [selected,setSelected]=useState<Invoice|null>(null);
 const patientName=(id:string)=>patients.find(p=>p.id===id)?.name??"Patient non renseigné";
 const issued=invoices.filter(i=>i.status==="Émise");
 const filtered=invoices.filter(i=>(!payment||i.paymentStatus===payment)&&(!status||i.status===status)&&(!kind||i.lines.some(l=>l.kind===kind))&&`${patientName(i.patientId)} ${i.id}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
 return <div className={ui.page}><header className={ui.heading}><div><p className={ui.eyebrow}>Suivi administratif</p><h1 className={ui.title}>Facturation</h1><p className={ui.description}>Factures, prestations et suivi des règlements du cabinet.</p></div><button className={ui.action} disabled title="La génération de factures sera raccordée au service de facturation">Nouvelle facture</button></header>
 <ModuleSummary items={[{label:"Total émis",value:formatAmount(issued.reduce((sum,i)=>sum+invoiceTotal(i),0))},{label:"Règlements enregistrés",value:formatAmount(issued.reduce((sum,i)=>sum+i.paidAmount,0))},{label:"Reste à régler",value:formatAmount(issued.reduce((sum,i)=>sum+invoiceBalance(i),0))}]}/>
 <div className={ui.toolbar}><label className={ui.search}><span className="sr-only">Rechercher une facture</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Patient ou numéro de facture…"/></label><div className={styles.filters}><label>Paiement<select value={payment} onChange={e=>setPayment(e.target.value)}><option value="">Tous</option>{["Payée","Partielle","Non payée"].map(v=><option key={v}>{v}</option>)}</select></label><label>Facture<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Toutes</option>{["Émise","Brouillon","Annulée"].map(v=><option key={v}>{v}</option>)}</select></label><label>Prestation<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Toutes</option>{Array.from(new Set(invoices.flatMap(i=>i.lines.map(l=>l.kind)))).map(v=><option key={v}>{v}</option>)}</select></label></div></div>
 <div className={ui.tableScroll}><table className={ui.table}><thead><tr><th>Facture / date</th><th>Patient</th><th>Prestation</th><th>Montant</th><th>Paiement</th><th>Facture</th><th>Action</th></tr></thead><tbody>{filtered.map(i=><tr key={i.id}><td><strong>{i.id}</strong><span className={styles.small}>{formatDate(i.date)}</span></td><td>{patientName(i.patientId)}</td><td>{Array.from(new Set(i.lines.map(l=>l.kind))).join(", ")}</td><td>{formatAmount(invoiceTotal(i))}<span className={styles.small}>Solde : {formatAmount(invoiceBalance(i))}</span></td><td><StatusBadge tone={i.paymentStatus==="Payée"?"success":i.paymentStatus==="Partielle"?"warning":"neutral"}>{i.paymentStatus}</StatusBadge></td><td><StatusBadge tone="neutral">{i.status}</StatusBadge></td><td><button className={styles.link} onClick={()=>setSelected(i)} aria-label={`Consulter ${i.id}`}>Consulter</button></td></tr>)}</tbody></table>{!filtered.length&&<p className={ui.empty}>Aucune facture ne correspond à ces critères.</p>}<footer className={ui.footer}>{filtered.length} document(s) · Données de démonstration</footer></div>
 <DetailDialog title="Détail de facturation" open={Boolean(selected)} onClose={()=>setSelected(null)}>{selected&&<InvoiceDetails invoice={selected} patient={patientName(selected.patientId)}/>}</DetailDialog>
 </div>;
}
