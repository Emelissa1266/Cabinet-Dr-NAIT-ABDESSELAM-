"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Patient } from "@/features/patients/types";
import { formatDate } from "@/lib/clinical-format";
import type { ClinicalPhoto } from "../types";
import ui from "@/components/ui/clinical.module.css";
import workspace from "@/components/ui/module-workspace.module.css";
import styles from "./photo-library.module.css";
export function PhotoLibrary({ photos,patients }: { photos:ClinicalPhoto[];patients:Patient[] }) {
 const [query,setQuery]=useState("");const [patient,setPatient]=useState("");const [phase,setPhase]=useState("");const [category,setCategory]=useState("");const [selected,setSelected]=useState<ClinicalPhoto|null>(null);
 const patientName=(id:string)=>patients.find(p=>p.id===id)?.name??"Patient non renseigné";
 const filtered=photos.filter(p=>(!patient||p.patientId===patient)&&(!phase||p.phase===phase)&&(!category||p.category===category)&&`${patientName(p.patientId)} ${p.intervention}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
 return <div className={ui.page}><header className={ui.heading}><div><p className={ui.eyebrow}>Imagerie clinique</p><h1 className={ui.title}>Photothèque</h1><p className={ui.description}>Suivi photographique des patients et des interventions.</p></div><button className={ui.action} disabled title="L’import sera activé avec le stockage privé">Importer des photos</button></header>
 <div className={ui.toolbar}><label className={ui.search}><span className="sr-only">Rechercher une photo</span><input placeholder="Patient ou intervention…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className={ui.tabs} aria-label="Période des photos">{["","Avant","Après"].map(value=><button key={value} className={ui.tab} aria-pressed={phase===value} onClick={()=>setPhase(value)}>{value||"Toutes"}</button>)}</div></div>
 <div className={workspace.filters}><label>Patient<select value={patient} onChange={e=>setPatient(e.target.value)}><option value="">Tous les patients</option>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Toutes les catégories</option>{Array.from(new Set(photos.map(p=>p.category))).map(c=><option key={c}>{c}</option>)}</select></label><button className={ui.action} onClick={()=>{setQuery("");setPatient("");setPhase("");setCategory("");}}>Réinitialiser</button></div>
 <p className={workspace.notice}>{filtered.length} cliché(s) · Images de démonstration uniquement.</p>
 <div className={styles.grid}>{filtered.map(photo=><button key={photo.id} className={styles.card} onClick={()=>setSelected(photo)} aria-label={`Voir la photo ${photo.phase.toLocaleLowerCase("fr")} de ${patientName(photo.patientId)} du ${photo.date}`}><div className={styles.image}><Image src={photo.image.src} alt={photo.image.alt} width={photo.image.width} height={photo.image.height} sizes="(max-width: 600px) 90vw, 320px"/><span className={styles.phase}><StatusBadge tone={photo.phase==="Avant"?"neutral":"teal"}>{photo.phase}</StatusBadge></span></div><div className={styles.caption}><strong>{patientName(photo.patientId)}</strong><span>{photo.intervention}</span><small>{formatDate(photo.date)} · {photo.category}</small></div></button>)}</div>
 {!filtered.length&&<section className={ui.panel}><p className={ui.empty}>Aucune photo pour ces critères.</p></section>}
 <DetailDialog title="Cliché clinique" open={Boolean(selected)} onClose={()=>setSelected(null)}>{selected&&<div className={workspace.stack}><Image className={styles.viewer} src={selected.image.src} alt={selected.image.alt} width={selected.image.width} height={selected.image.height} sizes="440px"/><dl><dt>Patient</dt><dd>{patientName(selected.patientId)}</dd><dt>Date</dt><dd>{formatDate(selected.date)}</dd><dt>Période</dt><dd>{selected.phase}</dd><dt>Intervention</dt><dd>{selected.intervention}</dd><dt>Catégorie</dt><dd>{selected.category}</dd><dt>Notes</dt><dd>{selected.notes||"Aucune note."}</dd></dl><Link className={ui.action} href={`/patients/${selected.patientId}`}>Consulter le dossier patient</Link></div>}</DetailDialog>
 </div>;
}
