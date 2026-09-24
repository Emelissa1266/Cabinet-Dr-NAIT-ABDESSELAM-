"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shared/icon";
import { completedSessions, type CareCategory, type CareNurse, type CareTreatment } from "../types";
import type { Patient } from "@/features/patients/types";
import { formatAmount, formatDate } from "@/lib/clinical-format";
import styles from "./care-workspace.module.css";

export function CareDetailPanel({ treatment, patient, category, nurses, onClose, onEdit, onDraft }: {
 treatment: CareTreatment; patient?: Patient; category?: CareCategory; nurses: CareNurse[];
 onClose: () => void; onEdit: () => void; onDraft: (notes: string) => Promise<void>;
}) {
 const [notes, setNotes] = useState(treatment.notes);
 const [feedback, setFeedback] = useState("");
 const [busy, setBusy] = useState(false);
 const planning = treatment.planning;
 const nurse = nurses.find(n => n.id === planning?.nurseId);
 return <section className={styles.detail} aria-label="Fiche de Soin">
 <header className={styles.detailHeader}><div className={styles.detailTop}><span className={styles.ficheLabel}>Fiche de Soin</span><span className={styles.reference}>#{treatment.id}</span><button className={styles.iconButton} onClick={onClose} aria-label="Fermer la fiche de soin">×</button></div><h2>{patient?.name ?? "Patient"}</h2><p><Link href={`/patients/${treatment.patientId}`}>#{treatment.patientId}</Link> · {patient?.age ?? "—"} ans · {category?.name}</p></header>
 <div className={styles.detailBody}>
 <section className={styles.execution}><div className={styles.sectionHeading}><h3>{treatment.status === "En cours" ? "Soin en cours d’exécution" : "Programme de soin"}</h3><span className={styles.status} data-status={treatment.status}>{planning?.startedAt ? `Débuté à ${planning.startedAt}` : treatment.status}</span></div><h4>{treatment.type}</h4><p>Durée prévue : {planning?.durationMinutes ?? "—"} min · {category?.name}</p><div className={styles.assignment}><span>Assigné par : <strong>{planning?.doctor ?? "Dr. Gaya"}</strong></span><span>Infirmier(ère) : <strong>{nurse?.name ?? "Non assigné"}</strong></span></div></section>
 <section className={styles.instructions}><h3><Icon name="care"/> Instructions du médecin</h3><p>{planning?.instructions || category?.description || "Aucune instruction renseignée."}</p></section>
 <section><div className={styles.sectionHeading}><h3><Icon name="filter"/> Paramètres du traitement</h3></div>{planning?.parameters.length ? <dl className={styles.parameters}>{planning.parameters.map(parameter => <div key={parameter.label}><dt>{parameter.label}</dt><dd>{parameter.value}</dd></div>)}</dl> : <p className={styles.muted}>Aucun paramètre spécifique à ce soin.</p>}<div className={styles.zone}><small>Zone anatomique traitée</small><div><strong>{planning?.zone || "Non renseignée"}</strong>{planning?.phototype && <span>Phototype {planning.phototype}</span>}</div></div></section>
 <section><h3 className={styles.minorHeading}>Tolérance du patient</h3><div className={styles.tolerance} aria-label="Tolérance observée">{["Bonne", "Moyenne", "Difficile"].map(value => <span key={value} data-active={planning?.tolerance === value}>{value}</span>)}</div>{!planning?.tolerance && <small className={styles.muted}>Non renseignée par le personnel infirmier.</small>}<h3 className={styles.minorHeading}>Observations infirmières</h3><p className={styles.observation}>{planning?.observations || "Aucune observation enregistrée."}</p></section>
 <label className={styles.notes}>Notes du praticien<textarea value={notes} onChange={event => { setNotes(event.target.value); setFeedback(""); }} maxLength={2000}/></label>
 <details className={styles.history}><summary>Programme, séances & facturation</summary><dl><dt>Date de début</dt><dd>{formatDate(treatment.startDate)}</dd><dt>Séances réalisées</dt><dd>{completedSessions(treatment)} / {treatment.plannedSessions} · {treatment.plannedSessions - completedSessions(treatment)} restantes</dd><dt>Tarif par séance</dt><dd>{formatAmount(treatment.pricePerSession)}</dd><dt>Total prévu</dt><dd>{formatAmount(treatment.pricePerSession * treatment.plannedSessions)}</dd></dl><h3>Historique des séances</h3>{treatment.sessions.length ? <ul>{treatment.sessions.map(session => <li key={session.id}><strong>{formatDate(session.date)} · {session.status}</strong><p>{session.notes}</p></li>)}</ul> : <p>Aucune séance enregistrée.</p>}</details>
 </div>
 <footer className={styles.detailFooter}><button className={styles.completeButton} disabled title="Seul le personnel infirmier peut valider une séance">✓ Valider et terminer le soin</button><small>Validation réservée à l’infirmier(ère).</small><div className={styles.footerActions}><button disabled={busy} onClick={async () => { setBusy(true); try { await onDraft(notes); setFeedback("Brouillon enregistré dans cette démonstration."); } catch { setFeedback("Échec de l’enregistrement. Réessayez."); } finally { setBusy(false); } }}>{busy ? "Enregistrement…" : "Enregistrer brouillon"}</button><Link href={`/patients/${treatment.patientId}`}>Voir dossier patient</Link></div><button className={styles.editLink} onClick={onEdit}>Modifier le programme et l’affectation</button>{feedback && <p role="status">{feedback}</p>}</footer>
 </section>;
}
