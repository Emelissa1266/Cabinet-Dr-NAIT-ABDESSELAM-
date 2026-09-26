"use client";
import Link from "next/link";
import { useState } from "react";
import { useNurse } from "./nurse-provider";
import { SessionExecution } from "./session-execution";
import { SessionList } from "./session-list";
import { programProgress } from "../services/session-state";
import { formatDate } from "@/lib/clinical-format";
import { StatusBadge } from "@/components/ui/status-badge";
import styles from "./nurse.module.css";
export function NurseDashboard() {
    const { data, execute } = useNurse();
    const [filter, setFilter] = useState("Tous");
    const [selectedId, setSelectedId] = useState("NS-02");
    const [message, setMessage] = useState("");
    const today = data.sessions.filter(s => s.date === data.date);
    const selected = today.find(s => s.id === selectedId) ?? today[0];
    const program = selected && data.programs.find(p => p.id === selected.programId);
    const patient = program && data.patients.find(p => p.id === program.patientId);
    const progress = program && programProgress(data, program);
    const filtered = today.filter(s => filter === "Tous" || (filter === "À faire" ? s.status === "Planifié" : s.status === "Terminé"));
    return <div className={styles.page}><header className={styles.heading}><div><p className={styles.eyebrow}>Unité de soins dermatologiques & bloc externe</p><h1>Bonjour Nadia</h1><p>Voici votre activité clinique et vos protocoles programmés.</p></div><span className={styles.dateBadge}>{formatDate(data.date)} · Planning de démonstration</span></header>
 <div className={styles.summary}><span>Soins du jour <strong>{today.length}</strong></span><span>À faire <strong>{today.filter(s => s.status === "Planifié").length}</strong></span><span>En cours <strong>{today.filter(s => s.status === "En cours").length}</strong></span><span>Terminés <strong>{today.filter(s => s.status === "Terminé").length}</strong></span><small>Suivi des soins & transmissions</small></div>
 {selected && program && patient && progress && <section className={styles.hero}><div className={styles.heroTop}><div><StatusBadge tone="warning">{selected.status} · {selected.start}</StatusBadge><span className={styles.reference}>Dossier #{patient.id} · {selected.room}</span><h2>{patient.name}<small>{patient.age} ans · Phototype {patient.phototype}</small></h2></div>{selected.status === "Planifié" ? <button className={styles.primary} onClick={() => { try {
        execute({ type: "start", id: selected.id, at: new Date().toISOString() });
        setMessage("Soin démarré. Ouvrez la fiche pour renseigner la séance.");
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : "Erreur");
    } }}>Commencer le soin →</button> : <Link className={styles.primary} href={`/nurse/care?session=${selected.id}`}>{selected.status === "Terminé" ? "Voir le compte-rendu" : "Continuer le soin"} →</Link>}</div><div className={styles.heroDetails}><div className={styles.inset}><small>Acte prescrit</small><h3>{program.name}</h3><p>{progress.completed} / {progress.total} réalisées · {progress.remaining} restantes</p></div><div className={styles.inset}><small>Prescription médicale · {program.doctor}</small><p>{program.protocol}</p></div></div><div className={styles.actions}><Link href={`/nurse/patients/${patient.id}`}>Voir dossier patient</Link><Link href={`/nurse/care?session=${selected.id}`}>Ouvrir la fiche de soin</Link></div></section>}
 {message && <p role="status" className={styles.feedback}>{message}</p>}
 <div className={styles.columns}><section><div className={styles.sectionHeading}><div><h2>Mes soins du jour</h2><p>Programme journalier des actes infirmiers</p></div><div className={styles.segmented}>{["Tous", "À faire", "Historique"].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div></div><SessionList sessions={filtered} selectedId={selectedId} onSelect={s => { setSelectedId(s.id); setMessage(""); }}/><Link className={styles.photoShortcut} href="/nurse/phototheque"><strong>Photothèque médicale comparative</strong><span>Consulter les clichés avant / après →</span></Link></section>{selected && <SessionExecution key={selected.id} sessionId={selected.id}/>}</div></div>;
}
