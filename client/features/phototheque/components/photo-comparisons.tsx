"use client";

import { useEffect, useState } from "react";
import type { ClinicalPhotoApi, ClinicalPhotoComparisonApi, ClinicalPhotoType } from "@/features/documents/api-types";
import { createClinicalPhotoComparison, listClinicalPhotoComparisons, listClinicalPhotos } from "@/features/documents/services/document-api-service";
import { PrivateClinicalImage } from "@/features/documents/components/private-clinical-image";
import { clinicalPhotoErrorMessage } from "@/features/documents/services/photo-workflow";
import { dateTime, photoTypeLabels } from "@/features/documents/services/document-display";
import { PatientPicker } from "./gallery-pickers";
import ui from "@/components/ui/clinical.module.css";
import styles from "./photo-gallery.module.css";

function ComparisonPhotoPicker({ patient, type, label, value, onChange }: { patient: string; type: ClinicalPhotoType; label: string; value: string; onChange: (id: string) => void }) {
  const [photos, setPhotos] = useState<ClinicalPhotoApi[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    listClinicalPhotos({ patient, photo_type: type, page }).then(result => {
      if (active) { setPhotos(result.results); setNext(Boolean(result.next)); setError(""); }
    }).catch(cause => { if (active) setError(clinicalPhotoErrorMessage(cause, "Impossible de charger les photos.")); });
    return () => { active = false; };
  }, [patient, type, page]);
  return <div><label>{label}<select required value={value} onChange={e => onChange(e.target.value)}><option value="">Sélectionner une photo</option>{value && !photos.some(p => String(p.id) === value) && <option value={value}>Photo sélectionnée</option>}{photos.map(p => <option key={p.id} value={p.id}>{p.anatomical_area} · {dateTime(p.captured_at || p.created_at)}</option>)}</select></label><div className={ui.actions}><button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Photos précédentes</button><button type="button" disabled={!next} onClick={() => setPage(p => p + 1)}>Photos suivantes</button></div>{error && <p role="alert">{error}</p>}</div>;
}

export function PhotoComparisons({ patientId = "", canWrite, fixedPatient = false, onSaved, onBusy }: { patientId?: string; canWrite: boolean; fixedPatient?: boolean; onSaved?: () => void; onBusy?: (busy: boolean) => void }) {
  const [patient, setPatient] = useState(patientId);
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [type, setType] = useState<ClinicalPhotoType>("AFTER");
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [comparisons, setComparisons] = useState<ClinicalPhotoComparisonApi[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!patient) return;
    let active = true;
    listClinicalPhotoComparisons({ patient, page }).then(result => { if (active) { setComparisons(result.results); setNext(Boolean(result.next)); } }).catch(cause => { if (active) setError(clinicalPhotoErrorMessage(cause, "Impossible de charger les comparaisons.")); });
    return () => { active = false; };
  }, [patient, page, revision]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const notes = String(new FormData(event.currentTarget).get("notes") || "");
    setBusy(true); onBusy?.(true); setError("");
    try { await createClinicalPhotoComparison({ patient, before_photo: before, after_photo: after, notes }); setRevision(v => v + 1); setMessage("Comparaison enregistrée."); onSaved?.(); }
    catch (cause) { setError(clinicalPhotoErrorMessage(cause, "Impossible de créer la comparaison.")); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <div className={ui.form}>
    {!fixedPatient && <PatientPicker value={patient} onChange={id => { setPatient(id); setBefore(""); setAfter(""); setComparisons([]); setPage(1); }} />}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {patient && canWrite && <form onSubmit={submit} className={ui.form}><fieldset disabled={busy} className={styles.fields}><legend>Créer une comparaison</legend>
      <ComparisonPhotoPicker key={`${patient}-before`} patient={patient} type="BEFORE" label="Photo avant" value={before} onChange={setBefore} />
      <label>Type de suivi<select value={type} onChange={e => { setType(e.target.value as ClinicalPhotoType); setAfter(""); }}><option value="AFTER">Après</option><option value="PROGRESS">Évolution</option></select></label>
      <ComparisonPhotoPicker key={`${patient}-${type}`} patient={patient} type={type} label={`Photo ${photoTypeLabels[type].toLowerCase()}`} value={after} onChange={setAfter} />
      <div className={styles.comparison}>{before && <PrivateClinicalImage key={`before-${before}`} photoId={Number(before)} alt="Aperçu avant" />}{after && <PrivateClinicalImage key={`after-${after}`} photoId={Number(after)} alt="Aperçu après" />}</div><label>Notes<textarea name="notes" /></label><button className={`${ui.action} ${ui.primary}`} disabled={busy || !before || !after}>{busy ? "Enregistrement…" : "Créer la comparaison"}</button>
    </fieldset></form>}
    <div className={styles.comparisonCards}>{patient && comparisons.map(comparison => <section className={styles.comparisonCard} key={comparison.id}><h3>Avant / après · {dateTime(comparison.created_at)}</h3><div className={styles.comparison}><PrivateClinicalImage photoId={comparison.before_photo} thumbnail alt="Photographie avant" /><PrivateClinicalImage photoId={comparison.after_photo} thumbnail alt="Photographie après ou évolution" /></div><p>{comparison.notes}</p></section>)}</div>
    {patient && !comparisons.length && <p>Aucune comparaison enregistrée.</p>}
    {patient && <div className={ui.actions}><button className={ui.action} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</button><span>Page {page}</span><button className={ui.action} disabled={!next} onClick={() => setPage(p => p + 1)}>Suivant</button></div>}
  </div>;
}
