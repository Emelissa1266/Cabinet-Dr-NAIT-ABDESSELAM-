"use client";
import { useState } from "react";
import Link from "next/link";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Patient } from "@/features/patients/types";
import { formatDate } from "@/lib/clinical-format";
import type { Prescription, PrescriptionDraft } from "../types";
import { prescriptionService } from "../services/prescription-service";
import { PrescriptionEditor } from "./prescription-editor";
import ui from "@/components/ui/clinical.module.css";
import styles from "@/components/ui/module-workspace.module.css";
export function PrescriptionWorkspace({ initialPrescriptions,patients }: { initialPrescriptions:Prescription[];patients:Patient[] }) {
 const [prescriptions,setPrescriptions]=useState(initialPrescriptions);
 const [query,setQuery]=useState("");const [status,setStatus]=useState("");
 const [selected,setSelected]=useState<Prescription|null>(null);const [creating,setCreating]=useState(false);const [message,setMessage]=useState("");
 const patientName=(id:string)=>patients.find(p=>p.id===id)?.name??"Patient non renseigné";
 const filtered=prescriptions.filter(p=>(!status||p.status===status)&&`${patientName(p.patientId)} ${p.id} ${p.medications.map(m=>m.name).join(" ")}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
 async function save(draft:PrescriptionDraft){const result=await prescriptionService.prepare(draft);setPrescriptions(current=>[result,...current]);setCreating(false);setMessage("Brouillon enregistré pour cette démonstration. Les données seront réinitialisées au rechargement.");}
 return <div className={ui.page}><header className={ui.heading}><div><p className={ui.eyebrow}>Prescriptions médicales</p><h1 className={ui.title}>Ordonnances</h1><p className={ui.description}>Historique et préparation des prescriptions du cabinet.</p></div><button className={`${ui.action} ${ui.primary}`} onClick={()=>setCreating(true)}>Nouvelle ordonnance</button></header>
 <div className={ui.toolbar}><label className={ui.search}><span className="sr-only">Rechercher une ordonnance</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Patient, référence ou médicament…"/></label><div className={ui.tabs} aria-label="Filtrer les ordonnances">{["","Brouillon","Enregistrée"].map(value=><button key={value} className={ui.tab} aria-pressed={status===value} onClick={()=>setStatus(value)}>{value||"Toutes"}</button>)}</div></div>
 <p className={styles.feedback} role="status">{message}</p>
 <div className={ui.tableScroll}><table className={ui.table}><thead><tr><th>Date / référence</th><th>Patient</th><th>Prescription</th><th>Praticien</th><th>Statut</th><th>Action</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td>{formatDate(p.date)}<span className={styles.small}>{p.id.startsWith("ORD-DEMO")?"Brouillon local":p.id}</span></td><td><strong>{patientName(p.patientId)}</strong></td><td>{p.medications.length} médicament(s)<span className={styles.small}>{p.medications[0]?.name}</span></td><td>{p.doctor}</td><td><StatusBadge tone={p.status==="Brouillon"?"neutral":"teal"}>{p.status}</StatusBadge></td><td><button className={styles.link} onClick={()=>setSelected(p)} aria-label={`Voir l’ordonnance de ${patientName(p.patientId)} du ${p.date}`}>Consulter</button></td></tr>)}</tbody></table>{!filtered.length&&<p className={ui.empty}>Aucune ordonnance ne correspond à votre recherche.</p>}</div>
 <DetailDialog title="Nouvelle ordonnance" open={creating} onClose={()=>setCreating(false)}>{creating&&<PrescriptionEditor patients={patients} onSave={save}/>}</DetailDialog>
 <DetailDialog title="Détail de l’ordonnance" open={Boolean(selected)} onClose={()=>setSelected(null)}>{selected&&<><h3>{patientName(selected.patientId)}</h3><p>{formatDate(selected.date)} · {selected.doctor}</p><StatusBadge tone="teal">{selected.status}</StatusBadge><section className={styles.section}><h3>Prescription</h3><ol className={styles.list}>{selected.medications.map(m=><li key={m.id}><strong>{m.name}</strong><p>{m.dosage}</p><p>{m.frequency} · {m.duration}</p>{m.instructions&&<small>{m.instructions}</small>}</li>)}</ol></section><section className={styles.section}><h3>Instructions générales</h3><p>{selected.notes||"Aucune instruction complémentaire."}</p></section><div className={ui.actions}><Link className={ui.action} href={`/patients/${selected.patientId}`}>Dossier patient</Link><button className={ui.action} disabled title="Impression disponible lors d’une prochaine intégration">Imprimer</button><button className={ui.action} disabled title="La génération de PDF n’est pas encore activée">Exporter PDF</button></div></>}</DetailDialog>
 </div>;
}
