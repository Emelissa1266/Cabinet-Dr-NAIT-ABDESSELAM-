"use client";
import Link from "next/link";
import {DetailDialog} from "@/components/ui/detail-dialog";
import {NursePatientEditor} from "./nurse-patient-editor";
import { useState } from "react";
import { useNurse } from "./nurse-provider";
import { SessionList } from "./session-list";
import { programProgress } from "../services/session-state";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/clinical-format";
import styles from "./nurse.module.css";
export function NursePatients({ initialQuery = "" }: {
    initialQuery?: string;
}) { const [adding,setAdding]=useState(false); const { data } = useNurse(); const [query, setQuery] = useState(initialQuery); const patients = data.patients.filter(p => (p.name + " " + p.id).toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))); return <div className={styles.page}><header><p className={styles.eyebrow}>Espace infirmier</p><h1>Patients</h1><button className={styles.primary} onClick={()=>setAdding(true)}>+ Nouveau patient</button><p>Patients suivis dans vos programmes de soins.</p></header><div className={styles.toolbar}><input aria-label="Rechercher un patient" value={query} placeholder="Nom ou numéro de dossier…" onChange={e => setQuery(e.target.value)}/><span>{patients.length} patients</span></div><div className={styles.cards}>{patients.map(p => <Link className={styles.patientLink} key={p.id} href={"/nurse/patients/" + p.id}><article className={styles.panel}><div className={styles.identity}><span>{p.initials}</span><div><h2>{p.name}</h2><p>#{p.id} · {p.age} ans</p></div></div><p>{p.allergies}</p><strong>Consulter le dossier →</strong></article></Link>)}</div>{!patients.length && <p className={styles.empty}>Aucun patient trouvé.</p>}<DetailDialog title="Nouveau patient de soins" open={adding} onClose={()=>setAdding(false)}>{adding&&<NursePatientEditor onClose={()=>setAdding(false)}/>}</DetailDialog></div>; }
export function NursePatientDetail({ id }: {
    id: string;
}) {
    const { data } = useNurse();
    const router = useRouter();
    const [editing,setEditing]=useState(false);
    const [tab, setTab] = useState("Vue d’ensemble");
    const patient = data.patients.find(p => p.id === id);
    if (!patient)
        return <div className={styles.page}><h1>Patient introuvable</h1><Link href="/nurse/patients">Retour aux patients</Link></div>;
    const programs = data.programs.filter(p => p.patientId === id);
    const sessions = data.sessions.filter(s => programs.some(p => p.id === s.programId));
    return <div className={styles.page}><header className={styles.panel}><div className={styles.heading}><div className={styles.identity}><span>{patient.initials}</span><div><h1>{patient.name}</h1><p>{patient.age} ans · Dossier #{id}</p></div></div><div><small>Contact patient</small><p>{patient.phone}</p><p>{patient.email}</p><button className={styles.secondary} onClick={()=>setEditing(true)}>Modifier les coordonnées</button></div></div><div className={styles.segmented}>{["Vue d’ensemble", "Soins", "Photothèque", "Interventions"].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div></header>
 {tab === "Photothèque" ? <section className={styles.panel}><h2>Photothèque clinique de contrôle</h2><p>Clichés organisés par soin et séance.</p><Link className={styles.primary} href={"/nurse/phototheque?patient=" + id}>Consulter les photos</Link></section> : tab === "Interventions" ? <section className={styles.panel}><h2>Intervention rattachée aux soins</h2>{patient.intervention ? <><h3>{patient.intervention.name}</h3><p>{formatDate(patient.intervention.date)} · {patient.intervention.doctor}</p><div className={styles.inset}><p>{patient.intervention.followUp}</p></div></> : <p>Aucune intervention rattachée.</p>}</section> : <div className={styles.columns}><section>
 {tab === "Vue d’ensemble" && <div className={styles.panel}><h2>Informations médicales essentielles au soignant</h2><div className={styles.cards}><div className={styles.warning}><h3>Allergies & contre-indications</h3><p>{patient.allergies}</p></div><div className={styles.inset}><h3>Phototype {patient.phototype}</h3><p>{patient.precautions}</p></div><div className={styles.inset}><h3>Antécédents pertinents</h3><p>{patient.relevantHistory}</p></div><div className={styles.inset}><h3>Suivi postopératoire</h3><p>{patient.intervention?.followUp ?? "Aucun suivi postopératoire associé."}</p></div></div></div>}
 <section className={styles.panel}><h2>Forfaits & protocoles en cours</h2>{programs.map(p => { const progress = programProgress(data, p); return <article className={styles.inset} key={p.id}><h3>{p.name}</h3><p>{p.protocol}</p><div className={styles.progressLabel}><span>{progress.completed} / {progress.total} réalisées</span><strong>{progress.remainingToComplete} non terminées</strong></div><progress max={progress.total} value={progress.completed}/><p><small>Prescrit par {p.doctor} · {p.zone}</small></p></article>; })}</section><section><h2>Historique & activité de soins</h2><SessionList sessions={sessions} showDate onSelect={s => router.push("/nurse/care?session=" + s.id)}/></section></section><aside><section className={styles.panel}><h2>Photothèque clinique</h2><p>Avant / après · Contexte de prise de vue</p><Link className={styles.primary} href={"/nurse/phototheque?patient=" + id}>Consulter la photothèque</Link></section><section className={styles.panel}><h2>Constantes du dossier</h2>{patient.vitals ? <div className={styles.cards}>{patient.vitals.map(v => <div key={v.label} className={styles.inset}><small>{v.label}</small><h3>{v.value}</h3></div>)}</div> : <p>Aucune constante renseignée.</p>}<small>Données de démonstration · Lecture seule</small></section></aside></div>}<DetailDialog title="Coordonnées du patient" open={editing} onClose={()=>setEditing(false)}>{editing&&<NursePatientEditor patient={patient} onClose={()=>setEditing(false)}/>}</DetailDialog></div>;
}
