"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useNurse } from "./nurse-provider";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { formatDate } from "@/lib/clinical-format";
import styles from "./nurse.module.css";
export function NursePhotos({ initialPatient }: {
    initialPatient?: string;
}) {
    const { data } = useNurse();
    const [patientId, setPatientId] = useState(initialPatient ?? "P-00254");
    const [phase, setPhase] = useState("Tous");
    const [category, setCategory] = useState("Tous");
    const [selectedId, setSelectedId] = useState("");
    const [viewer, setViewer] = useState(false);
    const photos = data.photos.filter(p => p.patientId === patientId && (phase === "Tous" || p.phase === phase) && (category === "Tous" || p.category === category));
    const selected = photos.find(p => p.id === selectedId) ?? photos[0];
    const patient = data.patients.find(p => p.id === patientId);
    const program = data.programs.find(p => p.id === selected?.programId);
    return <div className={styles.page}><header><p className={styles.eyebrow}>Photothèque médicale</p><h1>Photothèque</h1><p>Suivi iconographique et comparaison des clichés associés aux soins.</p></header><div className={styles.toolbar}><select aria-label="Patient de la photothèque" value={patientId} onChange={e => { setPatientId(e.target.value); setCategory("Tous"); setSelectedId(""); }}>{data.patients.map(p => <option key={p.id} value={p.id}>{p.name} · #{p.id}</option>)}</select><select aria-label="Catégorie des photos" value={category} onChange={e => setCategory(e.target.value)}>{["Tous", ...new Set(data.photos.filter(p => p.patientId === patientId).map(p => p.category))].map(v => <option key={v}>{v}</option>)}</select><div className={styles.segmented}>{["Tous", "Avant", "Après"].map(v => <button key={v} aria-pressed={phase === v} onClick={() => setPhase(v)}>{v === "Tous" ? "Comparer avant / après" : v}</button>)}</div><span>{photos.length} clichés</span></div>
 <div className={styles.columns}><section className={styles.panel}><h2>{patient?.name}</h2><p>Historique clinique · Clichés de démonstration</p>{photos.length ? <><div className={styles.comparison}>{photos.map(photo => <button className={styles.photoButton} aria-pressed={selected?.id === photo.id} key={photo.id} onClick={() => setSelectedId(photo.id)}><strong>{photo.phase} · {formatDate(photo.date)}</strong><Image loading="eager" className={styles.photo} src={photo.image.src} alt={photo.image.alt} width={photo.image.width} height={photo.image.height}/><h3>{photo.zone} · Séance {photo.sessionNumber}</h3><p>{data.programs.find(p => p.id === photo.programId)?.name}</p></button>)}</div><p>Vues de face et de profil différentes : comparaison illustrative, sans mesure clinique standardisée.</p></> : <p className={styles.empty}>Aucun cliché associé à ce patient et à ces filtres.</p>}</section><aside className={styles.panel}><h2>Fiche cliché & contexte</h2>{selected ? <><Image loading="eager" className={styles.photo} src={selected.image.src} alt={selected.image.alt} width={selected.image.width} height={selected.image.height}/><div className={styles.cards}><div><small>Patient</small><p>{patient?.name}</p><small>Date</small><p>{formatDate(selected.date)}</p></div><div><small>Zone</small><p>{selected.zone}</p><small>Séance</small><p>{selected.sessionNumber}</p></div></div><div className={styles.inset}><h3>{program?.name}</h3><p>{selected.notes}</p></div><div className={styles.actions}><button className={styles.primary} onClick={() => setViewer(true)}>Ouvrir le cliché</button><Link href={"/nurse/patients/" + patientId}>Dossier patient</Link></div></> : <p>Sélectionnez un patient disposant de clichés.</p>}</aside></div><DetailDialog title="Cliché clinique" open={viewer && Boolean(selected)} onClose={() => setViewer(false)}>{selected && <><Image loading="eager" className={styles.photo} src={selected.image.src} alt={selected.image.alt} width={selected.image.width} height={selected.image.height}/><p>{patient?.name} · {selected.phase} · {formatDate(selected.date)}</p><p>{selected.notes}</p></>}</DetailDialog></div>;
}
