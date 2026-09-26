"use client";
import {DetailDialog} from "@/components/ui/detail-dialog";
import {CarePlanForm} from "./care-plan-form";
import { useState } from "react";
import { useNurse } from "./nurse-provider";
import { SessionList } from "./session-list";
import { SessionExecution } from "./session-execution";
import styles from "./nurse.module.css";
export function NurseCare({ initialSession }: {
    initialSession?: string;
}) {
    const { data } = useNurse();
 const [creating,setCreating]=useState(false);
    const [selectedId, setSelectedId] = useState(initialSession ?? "NS-02");
    const [filter, setFilter] = useState(initialSession ? "Tous" : "Aujourd’hui");
    const [category, setCategory] = useState("Tous");
    const [query, setQuery] = useState("");
    const sessions = data.sessions.filter(s => s.nurseId === data.nurse.id && (filter === "Tous" || (filter === "Aujourd’hui" ? s.date === data.date : filter === "À venir" ? s.date > data.date : s.status === filter))).filter(s => { const p = data.programs.find(p => p.id === s.programId); const patient = data.patients.find(x => x.id === p?.patientId); return (category === "Tous" || p?.category === category) && (patient?.name + " " + p?.name).toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")); }).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const selected = sessions.find(s => s.id === selectedId) ?? sessions[0];
    return <div className={styles.page}><header className={styles.heading}><div><p className={styles.eyebrow}>Protocoles cliniques</p><h1>Soins</h1><p>Exécution clinique de vos soins programmés.</p></div><button className={styles.primary} onClick={()=>setCreating(true)}>+ Nouveau soin</button><span className={styles.dateBadge}>{data.nurse.name} · Soins assignés</span></header><div className={styles.toolbar}><select aria-label="Période ou statut des soins" value={filter} onChange={e => setFilter(e.target.value)}>{["Aujourd’hui", "À venir", "À planifier", "En cours", "Terminé", "À revoir", "Tous"].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Catégorie du soin" value={category} onChange={e => setCategory(e.target.value)}>{["Tous", ...new Set(data.programs.map(p => p.category))].map(v => <option key={v}>{v}</option>)}</select><input placeholder="Patient ou soin…" aria-label="Rechercher un soin" value={query} onChange={e => setQuery(e.target.value)}/></div><div className={styles.columns}><section><SessionList sessions={sessions} selectedId={selected?.id} onSelect={s => setSelectedId(s.id)} showDate/><div className={styles.inset}><h3>Protocoles prescrits</h3><p>Les instructions médicales sont en lecture seule. Renseignez les paramètres réellement appliqués dans la fiche d’exécution.</p></div></section>{selected ? <SessionExecution key={selected.id} sessionId={selected.id}/> : <div className={styles.empty}>Sélectionnez une autre période ou catégorie.</div>}</div><DetailDialog title="Nouveau soin" open={creating} onClose={()=>setCreating(false)}>{creating&&<CarePlanForm onSave={id=>{setCreating(false);setFilter("À planifier");setCategory("Tous");setQuery("");setSelectedId(id+"-S1");}}/>}</DetailDialog></div>;
}
