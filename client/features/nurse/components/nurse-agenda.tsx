"use client";
import { useState } from "react";
import Link from "next/link";
import { useNurse } from "./nurse-provider";
import { agendaGroups } from "../services/agenda-layout";
import { SessionList } from "./session-list";
import { formatDate } from "@/lib/clinical-format";
import styles from "./nurse.module.css";
function shift(date: string, days: number) { const next = new Date(date + "T12:00:00Z"); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); }
export function NurseAgenda() {
    const { data } = useNurse();
    const [date, setDate] = useState(data.date);
    const [week, setWeek] = useState(false);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("Tous");
    const [selectedId, setSelectedId] = useState("NS-02");
    const days = Array.from({ length: week ? 7 : 1 }, (_, i) => shift(date, i));
    const sessions = data.sessions.filter(s => days.includes(s.date) && s.nurseId === data.nurse.id && (status === "Tous" || s.status === status)).filter(s => { const p = data.programs.find(p => p.id === s.programId); const patient = data.patients.find(x => x.id === p?.patientId); return (patient?.name + " " + p?.name).toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")); }).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const selected = sessions.find(s => s.id === selectedId) ?? sessions[0];
    const program = data.programs.find(p => p.id === selected?.programId);
    const patient = data.patients.find(p => p.id === program?.patientId);
    return <div className={styles.page}><header className={styles.heading}><div><p className={styles.eyebrow}>Agenda soins · {data.nurse.name}</p><h1>Agenda des Soins</h1><p>Planning de vos actes infirmiers et protocoles médico-esthétiques.</p></div><div className={styles.segmented}><button aria-pressed={!week} onClick={() => setWeek(false)}>Jour</button><button aria-pressed={week} onClick={() => setWeek(true)}>Semaine</button></div></header>
 <div className={styles.toolbar}><button aria-label="Période précédente" onClick={() => setDate(shift(date, week ? -7 : -1))}>‹</button><input type="date" aria-label="Date du planning" value={date} onChange={e => e.target.value && setDate(e.target.value)}/><button aria-label="Période suivante" onClick={() => setDate(shift(date, week ? 7 : 1))}>›</button><button onClick={() => setDate(data.date)}>Aujourd’hui (démo)</button><input aria-label="Rechercher dans le planning" placeholder="Patient ou soin…" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="Statut du planning" value={status} onChange={e => setStatus(e.target.value)}>{["Tous", "Planifié", "En cours", "Terminé", "À revoir", "Annulé"].map(v => <option key={v}>{v}</option>)}</select></div>
 <div className={styles.columns}><section><div className={styles.sectionHeading}><h2>{sessions.length} soins assignés</h2><small>{data.nurse.name}</small></div>{days.map(day => <section key={day}><h3>{formatDate(day)}</h3>{agendaGroups(sessions.filter(s => s.date === day)).map(group => <div key={group[0].id} className={styles.agendaGroup}>{group.length > 1 && <small>Créneaux simultanés · {group.length} soins</small>}<div className={styles.agendaColumns} style={{ gridTemplateColumns: `repeat(${group.length}, minmax(${group.length > 1 ? 280 : 0}px, 1fr))` }}>{group.map(s => <SessionList key={s.id} sessions={[s]} selectedId={selected?.id} onSelect={s => setSelectedId(s.id)}/>)}</div></div>)}{!sessions.some(s => s.date === day) && <p className={styles.empty}>Aucun soin ce jour.</p>}</section>)}</section><aside className={styles.panel}><h2>Fiche du soin</h2>{selected && program && patient ? <><div className={styles.identity}><span>{patient.initials}</span><div><strong>{patient.name}</strong><p>#{patient.id} · {patient.age} ans</p></div></div><h3>{program.name}</h3><p>{formatDate(selected.date)} · {selected.start} – {selected.end}</p><p>{selected.room} · {selected.status}</p><div className={styles.inset}><small>Instructions · {program.doctor}</small><p>{program.protocol}</p></div><div className={styles.warning}><strong>Précautions</strong><p>{patient.allergies}</p><p>{patient.precautions}</p></div><Link className={styles.primary} href={"/nurse/care?session=" + selected.id}>Ouvrir la fiche de soin</Link><div className={styles.actions}><Link href={"/nurse/patients/" + patient.id}>Dossier patient</Link></div></> : <p>Aucun soin sur cette période.</p>}</aside></div></div>;
}
