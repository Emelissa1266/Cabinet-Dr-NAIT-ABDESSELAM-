"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/shared/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { DetailDialog } from "@/components/ui/detail-dialog";
import type { Patient } from "../types";
import styles from "@/components/ui/clinical.module.css";

export function PatientList({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const filtered = patients.filter((patient) => (!category || patient.category === category) && [patient.name, patient.id, patient.phone].join(" ").toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
  function exportList() {
    const text = ["Patient;Identifiant;Téléphone;Statut", ...filtered.map((p) => [p.name, p.id, p.phone, p.status].join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "patients-demonstration.csv"; anchor.click(); URL.revokeObjectURL(url);
  }
  return (
    <div className={styles.page}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>Registre médical</p><h1 className={styles.title}>Patients</h1><p className={styles.description}>{patients.length} dossiers de démonstration</p></div><div className={styles.actions}><button className={styles.action} onClick={exportList}><Icon name="export" size={13} />Exporter</button><button className={`${styles.action} ${styles.primary}`} onClick={() => { setSaved(false); setNewOpen(true); }}><Icon name="add" size={13} />Nouveau patient</button></div></header>
      <div className={styles.toolbar}><label className={styles.search}><Icon name="search" /><span className="sr-only">Rechercher un patient</span><input placeholder="Rechercher un patient (nom, identifiant, téléphone)..." value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className={styles.tabs} aria-label="Filtrer les patients">{[["", "Tous"], ["follow-up", "En cours de suivi"], ["preop", "Préopératoire"], ["intervention", "Interventions du mois"]].map(([value, label]) => <button key={value} className={styles.tab} aria-pressed={category === value} onClick={() => setCategory(value)}>{label}</button>)}</div></div>
      <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Patient</th><th>Téléphone</th><th>Dernier rendez-vous</th><th>Prochain rendez-vous</th><th>Statut</th><th>Action</th></tr></thead><tbody>{filtered.map((patient) => <tr key={patient.id}><td><Link href={`/patients/${patient.id}`} className={styles.identity}><span className={styles.avatar}>{patient.initials}</span><span><strong>{patient.name}</strong><small>{patient.id} · {patient.age} ans</small></span></Link></td><td>{patient.phone}</td><td className={styles.muted}>{patient.lastVisit}</td><td>{patient.nextVisit} <small className={styles.muted}>{patient.nextTime}</small></td><td><StatusBadge tone={patient.category === "preop" ? "warning" : patient.category === "intervention" ? "teal" : "neutral"}>{patient.status}</StatusBadge></td><td><Link href={`/patients/${patient.id}`} aria-label={`Ouvrir le dossier de ${patient.name}`}><Icon name="patient-folder" /></Link></td></tr>)}</tbody></table>{filtered.length === 0 && <p className={styles.empty}>Aucun patient ne correspond à votre recherche.</p>}<div className={styles.footer}><span>{filtered.length} sur {patients.length} patients</span><span>Page 1 sur 1</span></div></div>
      <DetailDialog title="Nouveau patient" open={newOpen} onClose={() => setNewOpen(false)}>
        {saved ? <p role="status">Formulaire validé. L’enregistrement sera disponible après connexion à l’API ; aucun dossier n’a été créé.</p> : <form className={styles.form} onSubmit={(event) => { event.preventDefault(); setSaved(true); }}><h3>État civil & coordonnées</h3><label>Nom<input name="lastName" required /></label><label>Prénom<input name="firstName" required /></label><label>Date de naissance<input name="birthDate" type="date" required /></label><label>Téléphone mobile<input name="phone" type="tel" required /></label><label>Email confidentiel<input name="email" type="email" /></label><label>Adresse de résidence<input name="address" /></label><label>Notes administratives<textarea name="notes" /></label><h3>Informations médicales de base</h3><label>Allergies connues<textarea name="allergies" /></label><label>Antécédents<textarea name="history" /></label><label>Traitement en cours<input name="treatment" /></label><p className={styles.muted}>Aperçu du formulaire — aucun enregistrement réel.</p><button type="submit" className={`${styles.action} ${styles.primary}`}>Vérifier le formulaire</button></form>}
      </DetailDialog>
    </div>
  );
}
