"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/components/auth-provider";
import type { Patient } from "@/features/patients/types";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { PhotoViewer } from "@/features/phototheque/components/photo-viewer";
import { PhotoEditor, SeriesEditor } from "@/features/phototheque/components/gallery-editors";
import { SeriesPicker } from "@/features/phototheque/components/gallery-pickers";
import { PhotoComparisons } from "@/features/phototheque/components/photo-comparisons";
import type { ClinicalPhotoApi, ClinicalPhotoType } from "../api-types";
import { archiveClinicalPhoto, getClinicalPhoto, listClinicalPhotos } from "../services/document-api-service";
import { photoSeriesWindow } from "../services/patient-photo-navigation";
import { clinicalPhotoErrorMessage } from "../services/photo-workflow";
import { dateTime, photoTypeLabels } from "../services/document-display";
import { PrivateClinicalImage } from "./private-clinical-image";
import ui from "@/components/ui/clinical.module.css";
import styles from "./patient-photos-section.module.css";

export function PatientPhotosSection({ patient }: { patient: Patient }) {
  // Reset every modal and filter if the dossier changes without a full page reload.
  return <PatientGallery key={patient.apiId} patient={patient} />;
}

function PatientGallery({ patient }: { patient: Patient }) {
  const { user } = useAuth();
  const canWrite = user?.role === "DOCTOR" || user?.role === "NURSE";
  const viewerRequest = useRef(0);
  useEffect(() => () => { viewerRequest.current += 1; }, []);
  const [photos, setPhotos] = useState<ClinicalPhotoApi[]>([]);
  const [selected, setSelected] = useState<ClinicalPhotoApi | null>(null);
  const [navigation, setNavigation] = useState<{ photos: ClinicalPhotoApi[]; page: number; next: boolean }>({ photos: [], page: 1, next: false });
  const [filter, setFilter] = useState<ClinicalPhotoType | "">("");
  const [series, setSeries] = useState("");
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newSeries, setNewSeries] = useState(false);
  const [editor, setEditor] = useState<ClinicalPhotoApi | "new" | null>(null);
  const [comparing, setComparing] = useState(false);
  const [archiving, setArchiving] = useState<ClinicalPhotoApi | null>(null);
  const [archiveError, setArchiveError] = useState("");
  const patientId = String(patient.apiId);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const result = await listClinicalPhotos({ patient: patientId, photo_type: filter, photo_set: series || undefined, page, ordering: "-captured_at,-created_at" });
        if (active) { setPhotos(result.results); setNext(Boolean(result.next)); setCount(result.count); }
      } catch (cause) { if (active) setError(clinicalPhotoErrorMessage(cause, "Impossible de charger la galerie.")); }
      finally { if (active) setLoading(false); }
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [patientId, filter, series, page, revision]);
  function refresh(text: string) { setMessage(text); setRevision(value => value + 1); }
  async function open(photo: ClinicalPhotoApi) {
    const request = ++viewerRequest.current;
    setBusy(true); setError("");
    try {
      const detail = await getClinicalPhoto(photo.id);
      const window = await photoSeriesWindow(detail, patientId);
      if (request === viewerRequest.current) { setNavigation(window); setSelected(detail); }
    } catch (cause) { setError(clinicalPhotoErrorMessage(cause, "Impossible d’ouvrir cette photo.")); }
    finally { setBusy(false); }
  }
  const index = navigation.photos.findIndex(photo => photo.id === selected?.id);
  async function navigate(direction: -1 | 1) {
    if (!selected || busy) return;
    const request = ++viewerRequest.current;
    setBusy(true); setError("");
    try {
      let candidate = navigation.photos[index + direction];
      if (!candidate && selected.photo_set) {
        const targetPage = navigation.page + direction;
        const result = await listClinicalPhotos({ patient: patientId, photo_set: selected.photo_set, page: targetPage, ordering: "-captured_at,-created_at" });
        candidate = direction === 1 ? result.results[0] : result.results[result.results.length - 1];
        setNavigation({ photos: result.results, page: targetPage, next: Boolean(result.next) });
      }
      if (candidate) { const detail = await getClinicalPhoto(candidate.id); if (request === viewerRequest.current) setSelected(detail); }
    } catch (cause) { setError(clinicalPhotoErrorMessage(cause, "Navigation impossible.")); }
    finally { setBusy(false); }
  }
  async function archive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!archiving) return;
    const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
    setBusy(true); setArchiveError("");
    try {
      await archiveClinicalPhoto(archiving.id, reason); setArchiving(null);
      if (photos.length === 1 && page > 1) setPage(value => value - 1);
      refresh("Photo archivée. Le fichier et l’historique médical sont conservés.");
    } catch (cause) { setArchiveError(clinicalPhotoErrorMessage(cause, "Archivage refusé.")); }
    finally { setBusy(false); }
  }
  return <section className={`${ui.panel} ${styles.container}`} aria-label="Photothèque médicale du patient">
    <div className={ui.heading}><div><p className={ui.eyebrow}>Images privées</p><h2>Photothèque médicale</h2></div>
      {canWrite && <div className={ui.actions}><button className={ui.action} onClick={() => setNewSeries(true)}>+ Créer une série</button><button className={`${ui.action} ${ui.primary}`} onClick={() => setEditor("new")}>+ Ajouter une photo</button></div>}
    </div>
    <div className={styles.toolbar}><div className={ui.tabs}>{(["", "BEFORE", "AFTER", "PROGRESS", "OTHER"] as const).map(value => <button key={value} className={ui.tab} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{value ? photoTypeLabels[value] : "Toutes"}</button>)}</div>
      {canWrite && <button className={ui.action} onClick={() => setComparing(true)}>Comparer Avant / Après</button>}
    </div>
    <div className={`${ui.form} ${styles.series}`}><SeriesPicker key={revision} patient={patientId} value={series} onChange={id => { setSeries(id); setPage(1); }} /></div>
    {message && <p role="status" className={styles.feedback}>{message}</p>}
    {error && <p role="alert">{error}<button className={ui.action} onClick={() => setRevision(value => value + 1)}>Réessayer</button></p>}
    {loading ? <p role="status">Chargement des photographies…</p> : !error && <>
      <div className={styles.grid}>{photos.map(photo => <button key={photo.id} className={styles.card} disabled={busy} onClick={() => void open(photo)} aria-label={`Ouvrir ${photoTypeLabels[photo.photo_type]} ${photo.anatomical_area} · ${photo.id}`}>
        <div className={styles.thumbnail}><PrivateClinicalImage photoId={photo.id} thumbnail alt={`${photoTypeLabels[photo.photo_type]} · ${photo.anatomical_area}`} /><span className={styles.badge}><StatusBadge tone={photo.photo_type === "BEFORE" ? "neutral" : "teal"}>{photoTypeLabels[photo.photo_type]}</StatusBadge></span></div>
        <div className={styles.caption}><strong>{photo.anatomical_area}</strong><span>{dateTime(photo.captured_at || photo.created_at)}</span></div>
      </button>)}</div>
      {!photos.length && <p className={ui.empty}>Aucune photographie pour cette sélection.</p>}
      <footer className={ui.footer}><span>{count} photographie(s)</span><div className={ui.actions}><button className={ui.action} disabled={page === 1} onClick={() => setPage(value => value - 1)}>Précédent</button><span>Page {page}</span><button className={ui.action} disabled={!next} onClick={() => setPage(value => value + 1)}>Suivant</button></div></footer>
    </>}
    <section className={styles.saved}><h3>Comparaisons enregistrées</h3><PhotoComparisons key={revision} patientId={patientId} fixedPatient canWrite={false} /></section>
    {selected && <PhotoViewer photo={selected} canWrite={canWrite} archiveLabel="Archiver" previous={!busy && (index > 0 || navigation.page > 1)} next={!busy && (index < navigation.photos.length - 1 || navigation.next)} onPrevious={() => void navigate(-1)} onNext={() => void navigate(1)} onClose={() => { viewerRequest.current += 1; setSelected(null); }} onEdit={() => { setEditor(selected); setSelected(null); }} onArchive={() => { setArchiveError(""); setArchiving(selected); setSelected(null); }} />}
    <DetailDialog title="Créer une série" open={newSeries} onClose={() => { if (!editorBusy) setNewSeries(false); }}>{newSeries && <SeriesEditor patientId={patientId} fixedPatient onBusy={setEditorBusy} onCancel={() => setNewSeries(false)} onSave={value => { setNewSeries(false); setSeries(String(value.id)); setPage(1); refresh("Série créée."); }} />}</DetailDialog>
    <DetailDialog title={editor === "new" ? "Ajouter des photos" : "Modifier la photographie"} open={Boolean(editor)} onClose={() => { if (!editorBusy) setEditor(null); }}>{editor && <PhotoEditor patientId={patientId} fixedPatient photo={editor === "new" ? undefined : editor} onBusy={setEditorBusy} onCancel={() => setEditor(null)} onPartial={() => refresh("Les photos importées sont disponibles.")} onSave={() => { const created = editor === "new"; setEditor(null); if (created) { setSeries(""); setFilter(""); setPage(1); } refresh(created ? "Photographies importées." : "Informations modifiées."); }} />}</DetailDialog>
    <DetailDialog title="Comparer Avant / Après" open={comparing} onClose={() => { if (!editorBusy) setComparing(false); }}>{comparing && <PhotoComparisons patientId={patientId} fixedPatient canWrite onBusy={setEditorBusy} onSaved={() => { setComparing(false); refresh("Comparaison enregistrée."); }} />}</DetailDialog>
    <DetailDialog title="Archiver la photographie" open={Boolean(archiving)} onClose={() => { if (!busy) setArchiving(null); }}><form className={ui.form} onSubmit={archive}><p>La photo sera retirée de la galerie active. Le fichier et l’historique médical seront conservés.</p><label>Motif d’archivage<textarea name="reason" required disabled={busy} /></label>{archiveError && <p role="alert">{archiveError}</p>}<div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Archivage…" : "Confirmer l’archivage"}</button><button type="button" className={ui.action} disabled={busy} onClick={() => setArchiving(null)}>Annuler</button></div></form></DetailDialog>
  </section>;
}
