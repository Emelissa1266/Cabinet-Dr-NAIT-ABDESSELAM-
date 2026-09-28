"use client";
import {SessionTracking} from "./session-tracking";
import {CareFinancialSummary} from "./care-financial-summary";
import Link from "next/link";
import { useState } from "react";
import { useNurse } from "./nurse-provider";
import { programProgress } from "../services/session-state";
import type { NursingRecord, NursingAction } from "../types";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/clinical-format";
import styles from "./nurse.module.css";
export function SessionExecution({ sessionId }: {
    sessionId: string;
}) {
    const { data, execute } = useNurse();
    const session = data.sessions.find(s => s.id === sessionId)!;
    const program = data.programs.find(p => p.id === session.programId)!;
    const patient = data.patients.find(p => p.id === program.patientId)!;
    const [record, setRecord] = useState<NursingRecord>({ ...session.record });
    const [message, setMessage] = useState("");
    const [error, setError] = useState(false);
    const [report, setReport] = useState(false);
    const [incident, setIncident] = useState("");
    const progress = programProgress(data, program);
    const sequence = session.sessionNumber ?? 1;
    const required=data.careTypes?.find(t=>t.id===program.careTypeId)?.requiredParameters??[];
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const editable = session.status === "En cours";
    const completed = session.status === "Terminé";
    function act(action: NursingAction) { try {
        execute(action);
        setError(false);
        setMessage(action.type === "draft" ? "Brouillon enregistré pour cette visite." : action.type === "complete" ? "Soin terminé et validé. Le suivi du programme est à jour." : action.type === "report" ? "Signalement enregistré localement. La séance est à revoir ; aucun message externe n’a été envoyé." : "Soin démarré.");
        return true;
    }
    catch (e) {
        setError(true);
        setMessage(e instanceof Error ? e.message : "Impossible d’enregistrer.");
        return false;
    } }
    function field(key: keyof NursingRecord, label: string, multiline = false) { return <label className={styles.field}>{label}{multiline ? <textarea value={record[key]} disabled={!editable} onChange={e => setRecord({ ...record, [key]: e.target.value })}/> : <input value={record[key]} disabled={!editable} onChange={e => setRecord({ ...record, [key]: e.target.value })}/>}</label>; }
    return <section className={`${styles.panel} ${styles.execution}`} aria-label="Fiche d’exécution"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Fiche d’exécution · {session.id}</p><h2>{program.name}</h2></div><StatusBadge tone={completed ? "success" : editable ? "teal" : "neutral"}>{session.status}</StatusBadge></div><div className={styles.identity}><span>{patient.initials}</span><div><strong>{patient.name}</strong><p>#{patient.id} · {patient.age} ans · {patient.phone}</p><p>{program.category} · {program.doctor}</p></div></div><div className={styles.inset}><p>{session.date?formatDate(session.date):"À planifier"} · {session.start} – {session.end} · {minutes(session.end) - minutes(session.start)} min</p><p>{session.room} · {data.nurse.name}</p><div className={styles.progressLabel}><span>{progress.completed} réalisées / {progress.total} prévues</span><strong>{progress.remainingToComplete} non terminées</strong></div><progress value={progress.completed} max={progress.total}/><p>Séance {sequence} / {progress.total}</p></div><SessionTracking program={program}/><div className={styles.inset}><small>Instructions du médecin · {program.doctor}</small><p>{program.protocol}</p>{program.laser && <p>{program.laser.type} · {program.laser.device} · {program.laser.wavelength} · Prescription : {program.laser.fluence} J/cm² · Spot {program.laser.spotSize} mm · {program.laser.frequency} Hz</p>}</div><div className={styles.warning}><strong>Informations patient</strong><p>{patient.allergies} · Phototype {patient.phototype}</p><p>{patient.precautions}</p></div>
 {session.status === "Planifié" && <button className={styles.primary} onClick={() => act({ type: "start", id: session.id, at: new Date().toISOString() })}>Commencer le soin</button>}
 {(editable || completed) && <><h3>{completed ? "Compte-rendu validé" : "Exécution du soin & traçabilité"}</h3>{field("performedTreatment", "Soin réellement réalisé *")}{field("zone", "Zone anatomique traitée *")}{(program.laser || required.length>0) && <fieldset><legend>Paramètres laser appliqués</legend><p>Saisissez les valeurs effectivement utilisées.</p><div className={styles.formGrid}>{field("device", "Appareil *")}{field("wavelength", "Longueur d’onde (nm) *")}{field("fluence", "Fluence (J/cm²) *")}{field("spotSize", "Spot (mm) *")}{field("frequency", "Fréquence (Hz) *")}</div></fieldset>}
 <fieldset><legend>Tolérance du patient *</legend><div className={styles.segmented}>{(["Bonne", "Moyenne", "Difficile"] as const).map(v => <button disabled={!editable} aria-pressed={record.tolerance === v} key={v} onClick={() => setRecord({ ...record, tolerance: v })}>{v}</button>)}</div></fieldset><label className={styles.field}>Réaction cutanée *<select value={record.reaction} disabled={!editable} onChange={e => setRecord({ ...record, reaction: e.target.value as NursingRecord["reaction"] })}><option value="">Sélectionner</option>{["Aucune", "Légère", "Importante"].map(v => <option key={v}>{v}</option>)}</select></label>{field("observations", "Observations / résultats *", true)}{field("incidents", "Incidents / effets indésirables", true)}{field("notes", "Notes complémentaires", true)}
 {editable && <div className={`${styles.actions} ${styles.executionActions}`}><button className={styles.primary} onClick={() => act({ type: "complete", id: session.id, record, at: new Date().toISOString() })}>Terminer et valider le soin</button><button className={styles.secondary} onClick={() => act({ type: "draft", id: session.id, record, at: new Date().toISOString() })}>Enregistrer le brouillon</button></div>}{completed && <p className={styles.feedback}>Validé le {new Date(session.validatedAt!).toLocaleString("fr-FR")} · {data.nurse.name}. Compte-rendu en lecture seule.</p>}</>}
 {session.status === "À revoir" && <div className={styles.warning}><h3>Séance à revoir avec le praticien</h3><p className={styles.readOnly}>{session.record.incidents}</p></div>}
 {session.draftSavedAt && <p><small>Dernier enregistrement : {new Date(session.draftSavedAt).toLocaleTimeString("fr-FR")}. État conservé pendant cette visite, réinitialisé au rechargement.</small></p>}
 <CareFinancialSummary program={program}/>
 {message && <p role={error ? "alert" : "status"} className={error ? styles.error : styles.feedback}>{message}</p>}
 {!completed && session.status !== "Annulé" && <div className={styles.actions}><button className={styles.secondary} onClick={() => setReport(!report)}>Signaler un problème</button></div>}
 {report && <div className={styles.warning}><label className={styles.field}>Motif du signalement<textarea value={incident} onChange={e => setIncident(e.target.value)}/></label><p>La démonstration conserve ce signalement localement.</p><button className={styles.secondary} onClick={() => { if (editable && !act({ type: "draft", id: session.id, record, at: new Date().toISOString() }))
        return; if (act({ type: "report", id: session.id, message: incident, at: new Date().toISOString() }))
        setReport(false); }}>Enregistrer le signalement</button></div>}
 <div className={styles.actions}><Link href={"/nurse/patients/" + patient.id}>Dossier patient</Link><Link href={"/nurse/phototheque?patient=" + patient.id}>Photos avant / après</Link></div></section>;
}
