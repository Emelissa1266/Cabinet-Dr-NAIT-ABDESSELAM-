"use client";

import { useEffect, useState } from "react";
import type { ClinicalPhotoApi, ClinicalPhotoSetApi, CreateClinicalPhotoPayload } from "@/features/documents/api-types";
import { clinicalPhotoUploadRules, createClinicalPhotoSet, updateClinicalPhoto, updateClinicalPhotoSet, uploadClinicalPhoto } from "@/features/documents/services/document-api-service";
import { buildPhotoSetPayload, buildPhotoUploadPayload, capturedAtFromInput, clinicalPhotoErrorMessage } from "@/features/documents/services/photo-workflow";
import { localDateTimeInput, photoTypeLabels, viewAngleLabels } from "@/features/documents/services/document-display";
import { importPhotoFiles, toLocalCapture, validatePhotoFiles } from "../services/gallery-workflow";
import { PatientPicker, SeriesPicker } from "./gallery-pickers";
import ui from "@/components/ui/clinical.module.css";
import styles from "./photo-gallery.module.css";

export function SeriesEditor({ series, patientId = "", fixedPatient = false, onSave, onCancel, onBusy }: {
  series?: ClinicalPhotoSetApi; patientId?: string; fixedPatient?: boolean; onSave: (set: ClinicalPhotoSetApi) => void; onCancel: () => void; onBusy?: (busy: boolean) => void;
}) {
  const [patient, setPatient] = useState(series ? String(series.patient) : patientId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); onBusy?.(true); setError("");
    try {
      const payload = buildPhotoSetPayload(patient, { title: form.get("title"), anatomical_area: form.get("anatomical_area"), captured_at: form.get("captured_at"), notes: form.get("notes") });
      const result = series ? await updateClinicalPhotoSet(series.id, { ...payload, captured_at: payload.captured_at ?? null }) : await createClinicalPhotoSet(payload);
      onSave(result);
    } catch (cause) { setError(clinicalPhotoErrorMessage(cause, "Impossible d’enregistrer la série.")); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <form className={ui.form} onSubmit={submit}>
    <fieldset disabled={busy} className={styles.fields}>
      <PatientPicker value={patient} onChange={setPatient} disabled={fixedPatient || Boolean(series)} currentLabel={series?.patient_name} />
      <label>Nom de la série<input name="title" required maxLength={180} defaultValue={series?.title} list="clinical-series-titles" /></label>
      <datalist id="clinical-series-titles">{["Consultation initiale", "Préopératoire", "Postopératoire", "Suivi à 1 mois", "Suivi à 3 mois", "Suivi à 6 mois"].map(title => <option key={title} value={title} />)}</datalist>
      <label>Zone anatomique<input name="anatomical_area" required maxLength={80} defaultValue={series?.anatomical_area} /></label>
      <label>Date de la série<input name="captured_at" type="datetime-local" defaultValue={series ? toLocalCapture(series.captured_at) : localDateTimeInput()} /></label>
      <label>Description et notes médicales<textarea name="notes" defaultValue={series?.notes} /></label>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} disabled={busy || !patient}>{busy ? "Enregistrement…" : "Enregistrer la série"}</button><button type="button" className={ui.action} disabled={busy} onClick={onCancel}>Annuler</button></div>
  </form>;
}

function FilePreview({ file }: { file: File }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const timer = setTimeout(() => setSrc(url), 0);
    return () => { clearTimeout(timer); URL.revokeObjectURL(url); };
  }, [file]);
  return <figure>{src && (
    // Temporary local preview; no Next.js optimizer or public URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`Aperçu ${file.name}`} />
  )}<figcaption>{file.name}</figcaption></figure>;
}

export function PhotoEditor({ photo, patientId = "", series, fixedPatient = false, onSave, onPartial, onCancel, onBusy }: {
  photo?: ClinicalPhotoApi; patientId?: string; series?: ClinicalPhotoSetApi; fixedPatient?: boolean;
  onSave: (photo?: ClinicalPhotoApi) => void; onPartial: () => void; onCancel: () => void; onBusy?: (busy: boolean) => void;
}) {
  const [patient, setPatient] = useState(String(photo?.patient ?? series?.patient ?? patientId));
  const [setId, setSetId] = useState(String(photo?.photo_set ?? series?.id ?? ""));
  const [area, setArea] = useState(photo?.anatomical_area ?? series?.anatomical_area ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [rules, setRules] = useState<{ max_size: number; mime_types: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    if (photo) return;
    let active = true;
    clinicalPhotoUploadRules().then(value => { if (active) setRules(value); }).catch(cause => { if (active) setError(clinicalPhotoErrorMessage(cause, "Impossible de vérifier les limites d’importation.")); });
    return () => { active = false; };
  }, [photo]);
  function chooseFiles(incoming: File[]) {
    if (!rules) return;
    const problem = validatePhotoFiles(incoming, rules.max_size, rules.mime_types);
    setError(problem);
    if (!problem) setFiles(incoming);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    if (!photo) {
      const problem = rules ? validatePhotoFiles(files, rules.max_size, rules.mime_types) : "Les limites d’importation ne sont pas encore disponibles.";
      if (problem) { setError(problem); return; }
    }
    setBusy(true); onBusy?.(true);
    try {
      if (photo) {
        const saved = await updateClinicalPhoto(photo.id, { photo_set: setId ? Number(setId) : null, anatomical_area: area,
          photo_type: String(form.get("photo_type")) as ClinicalPhotoApi["photo_type"],
          view_angle: String(form.get("view_angle")) as ClinicalPhotoApi["view_angle"],
          captured_at: capturedAtFromInput(form.get("captured_at")) ?? null,
          description: String(form.get("description") || ""), notes: String(form.get("notes") || "") });
        onSave(saved);
      } else {
        const values = { photo_type: form.get("photo_type"), anatomical_area: area, view_angle: form.get("view_angle"), photo_set: setId,
          captured_at: form.get("captured_at"), description: form.get("description"), notes: form.get("notes") };
        const result = await importPhotoFiles(files, file => uploadClinicalPhoto(buildPhotoUploadPayload(patient, values, file) as CreateClinicalPhotoPayload), (done, total) => setProgress({ done, total }));
        if (result.failed.length) {
          setFiles(result.failed.map(item => item.file));
          setError(`${result.created.length} photo(s) importée(s). ${result.failed.length} échec(s). Seuls les fichiers en échec seront réessayés. ${clinicalPhotoErrorMessage(result.failed[0].cause, "Importation refusée.")}`);
          if (result.created.length) onPartial();
        } else onSave(result.created[0]);
      }
    } catch (cause) { setError(clinicalPhotoErrorMessage(cause, "Impossible d’enregistrer la photographie.")); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <form className={ui.form} onSubmit={submit}>
    <fieldset disabled={busy} className={styles.fields}>
      <PatientPicker value={patient} onChange={id => { setPatient(id); setSetId(""); }} disabled={fixedPatient || Boolean(photo)} currentLabel={photo?.patient_name} />
      {patient && <SeriesPicker key={patient} emptyLabel="Sans série" patient={patient} value={setId} currentSet={series} onChange={(id, set) => { setSetId(id); if (set) setArea(set.anatomical_area); }} />}
      <label>Catégorie<select name="photo_type" defaultValue={photo?.photo_type ?? "BEFORE"}>{Object.entries(photoTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Zone anatomique<input value={area} required maxLength={80} onChange={e => setArea(e.target.value)} /></label>
      <label>Angle de vue<select name="view_angle" defaultValue={photo?.view_angle ?? "OTHER"}>{Object.entries(viewAngleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Date de prise de vue<input name="captured_at" type="datetime-local" defaultValue={photo ? toLocalCapture(photo.captured_at) : localDateTimeInput()} /></label>
      {!photo && <>
        <label className={styles.dropzone} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) chooseFiles(Array.from(e.dataTransfer.files)); }}>
          Glissez vos photographies ici ou sélectionnez des fichiers
          <input type="file" multiple accept="image/jpeg,image/png,.jpg,.jpeg,.png" disabled={!rules} onChange={e => chooseFiles(Array.from(e.target.files ?? []))} />
          <small>JPEG / PNG{rules ? ` · ${(rules.max_size / 1024 / 1024).toFixed(0)} Mo maximum par photo` : " · Vérification des limites…"}</small>
        </label>
        <div className={styles.previews}>{files.map((file, index) => <FilePreview key={`${file.name}-${file.lastModified}-${index}`} file={file} />)}</div>
      </>}
      <label>Description / légende<textarea name="description" defaultValue={photo?.description} /></label>
      <label>Notes médicales<textarea name="notes" defaultValue={photo?.notes} /></label>
    </fieldset>
    {busy && !photo && <div role="status"><progress max={progress.total || 1} value={progress.done} /> {progress.done} / {progress.total} photo(s) traitée(s)</div>}
    {error && <p role="alert">{error}</p>}
    <div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} disabled={busy || !patient || (!photo && (!rules || !files.length))}>{busy ? "Enregistrement…" : photo ? "Enregistrer les informations" : "Importer les photos"}</button><button type="button" className={ui.action} disabled={busy} onClick={onCancel}>Annuler</button></div>
  </form>;
}
