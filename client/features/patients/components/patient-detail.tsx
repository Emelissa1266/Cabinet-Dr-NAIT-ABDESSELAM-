"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Patient } from "../types";
import type { sarahRecord } from "../data/mock-patient-record";
import ui from "@/components/ui/clinical.module.css";
import styles from "./patient-detail.module.css";

const tabs = ["Vue générale", "Médical", "Rendez-vous", "Interventions", "Ordonnances", "Soins", "Photos", "Documents", "Paiements"];
export function PatientDetail({ patient, record }: { patient: Patient; record: typeof sarahRecord | null }) {
  const [tab, setTab] = useState("Vue générale");
  const show = (name: string) => tab === "Vue générale" || tab === name;
  return (
    <div>
      <Breadcrumb items={[{ label: "Patients", href: "/patients" }, { label: patient.name }]} />
      <header className={styles.header}>
        <div className={styles.identity}>{record ? <Image src="/images/sarah-profile.png" width={64} height={64} alt="" className={styles.avatar} /> : <span className={ui.avatar}>{patient.initials}</span>}<div><div className={styles.name}><h1>{patient.name}</h1><StatusBadge tone="teal">{patient.status}</StatusBadge></div><p>{patient.id} · {patient.age} ans {record && "· Née le 14/04/1994"}</p></div><div className={ui.actions}><Link href="/agenda" className={ui.action}>Rendez-vous</Link><button className={`${ui.action} ${ui.primary}`} disabled title="La création de consultations sera disponible ultérieurement">Nouvelle consultation</button></div></div>
        <div className={styles.tabs} role="tablist" aria-label="Sections du dossier patient">{tabs.map((name, index) => <button id={`patient-tab-${index}`} key={name} role="tab" aria-selected={tab === name} aria-controls="patient-section" tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next]); document.getElementById(`patient-tab-${next}`)?.focus(); } }} onClick={() => setTab(name)}>{name}</button>)}</div>
      </header>
      <div id="patient-section" role="tabpanel" aria-labelledby={`patient-tab-${tabs.indexOf(tab)}`} className={styles.columns}>
        <div className={styles.stack}>
          {show("Médical") && <section className={ui.panel}><h2>Informations essentielles</h2><dl className={styles.info}><dt>Téléphone</dt><dd>{patient.phone}</dd><dt>Email personnel</dt><dd>{patient.email}</dd><dt>Date de naissance</dt><dd>{record?.birthDate ?? "Non renseignée"}</dd><dt>Médecin référent</dt><dd>{record?.doctor ?? "Dr. Gaya"}</dd></dl></section>}
          {show("Médical") && <section className={ui.panel}><h2>Alertes médicales</h2><div className={styles.warning}><h3>Allergies médicamenteuses</h3><p>{record?.allergy ?? "Aucune information renseignée."}</p></div><div className={styles.inset}><h3>Antécédents notables</h3><p>{record?.history ?? "Aucune information renseignée."}</p></div></section>}
          {show("Photos") && <section className={ui.panel}><h2>Photothèque clinique</h2>{record ? <div className={styles.photos}><Link href="/phototheque"><Image src="/images/sarah-before.png" width={240} height={180} alt="Cliché de démonstration avant intervention" /><span>Pré-op J-15</span></Link><Link href="/phototheque"><Image src="/images/sarah-after.png" width={240} height={180} alt="Cliché de démonstration après intervention" /><span>Post-op J+12</span></Link></div> : <p>Aucun cliché disponible.</p>}</section>}
        </div>
        <div className={styles.stack}>
          {show("Rendez-vous") && <section className={`${ui.panel} ${styles.next}`}><p className={ui.eyebrow}>Prochain rendez-vous</p><h2>{record?.nextAppointment ?? `${patient.nextVisit} à ${patient.nextTime}`}</h2><div className={styles.twoColumns}><div><h3>Type d’acte programmé</h3><p>{record?.nextType ?? patient.status}</p>{record && <p>{record.nextDescription}</p>}</div><div><h3>Praticien & espace</h3><p>Dr. Gaya</p><p>Salle de consultation 2</p></div></div></section>}
          {show("Interventions") && <section className={ui.panel}><h2>Dernière intervention chirurgicale</h2>{record ? <div className={styles.inset}><h3>{record.surgery}</h3><p>Réalisée le {record.surgeryDate}</p><p>{record.surgerySummary}</p><StatusBadge tone="teal">Compte-rendu validé</StatusBadge></div> : <p>Aucune intervention renseignée.</p>}</section>}
          {show("Médical") && <section className={ui.panel}><h2>Dernière consultation</h2>{record ? <div className={styles.inset}><h3>Examen clinique postopératoire</h3><p>10 septembre 2026</p><p>« {record.consultation} »</p></div> : <p>Aucune consultation renseignée.</p>}</section>}
          {tab === "Vue générale" && <section className={ui.panel}><h2>Activité récente</h2>{record ? <ol className={styles.timeline}>{record.activity.map((item) => <li key={item.title}><strong>{item.title}</strong><time>{item.date}</time><p>{item.description}</p></li>)}</ol> : <p>Aucune activité disponible.</p>}</section>}
          {["Ordonnances", "Soins", "Documents", "Paiements"].includes(tab) && <section className={ui.panel}><h2>{tab}</h2><p>Aucune donnée supplémentaire disponible dans ce dossier de démonstration.</p>{tab !== "Documents" && <Link className={ui.action} href={tab === "Ordonnances" ? "/prescriptions" : tab === "Soins" ? "/care" : "/billing"}>Ouvrir le module</Link>}</section>}
        </div>
      </div>
    </div>
  );
}
