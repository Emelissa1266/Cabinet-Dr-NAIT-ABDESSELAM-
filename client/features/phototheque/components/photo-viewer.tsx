"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ClinicalPhotoApi } from "@/features/documents/api-types";
import { PrivateClinicalImage } from "@/features/documents/components/private-clinical-image";
import { downloadBlob, fetchClinicalPhotoBlob } from "@/features/documents/services/document-api-service";
import { dateTime, formatFileSize, photoTypeLabels, viewAngleLabels } from "@/features/documents/services/document-display";
import { clinicalPhotoErrorMessage } from "@/features/documents/services/photo-workflow";
import ui from "@/components/ui/clinical.module.css";
import styles from "./photo-gallery.module.css";

export function PhotoViewer({ photo, canWrite, previous, next, onPrevious, onNext, onClose, onEdit, onArchive, archiveLabel = "Supprimer de la galerie" }: {
  photo: ClinicalPhotoApi; canWrite: boolean; previous: boolean; next: boolean; onPrevious: () => void; onNext: () => void;
  archiveLabel?: string; onClose: () => void; onEdit: () => void; onArchive: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function download() {
    setBusy(true); setError("");
    try { await downloadBlob(fetchClinicalPhotoBlob(photo.id, "download"), photo.original_filename); }
    catch (cause) { setError(clinicalPhotoErrorMessage(cause, "Téléchargement impossible.")); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className={styles.viewerDialog} aria-labelledby={title} onClose={onClose} onKeyDown={event => {
    if (event.key === "ArrowLeft" && previous) { event.preventDefault(); setZoom(1); onPrevious(); }
    if (event.key === "ArrowRight" && next) { event.preventDefault(); setZoom(1); onNext(); }
  }}>
    <header className={styles.viewerHeader}><h2 id={title}>{photo.description || photo.anatomical_area}</h2><button className={ui.action} onClick={onClose} aria-label="Fermer la photo">×</button></header>
    <div className={styles.viewerBody}>
      <div><div className={ui.actions}><button className={ui.action} disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))} aria-label="Réduire le zoom">−</button><span role="status">{Math.round(zoom * 100)} %</span><button className={ui.action} disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + .5))} aria-label="Agrandir la photo">+</button><button className={ui.action} onClick={() => setZoom(1)}>Réinitialiser le zoom</button></div><div className={styles.zoomViewport}><div style={{ width: `${zoom * 100}%`, height: `${zoom * 60}dvh` }}><PrivateClinicalImage key={photo.id} className={styles.zoomImage} photoId={photo.id} alt={`${photoTypeLabels[photo.photo_type]} · ${photo.anatomical_area}`} /></div></div></div>
      <aside><dl className={styles.details}>
        <dt>Patient</dt><dd>{photo.patient_name || photo.patient_reference}</dd><dt>Série</dt><dd>{photo.photo_set_title || "Sans série"}</dd>
        <dt>Date de prise</dt><dd>{dateTime(photo.captured_at || photo.created_at)}</dd><dt>Catégorie</dt><dd>{photoTypeLabels[photo.photo_type]}</dd>
        <dt>Zone anatomique</dt><dd>{photo.anatomical_area}</dd><dt>Vue</dt><dd>{viewAngleLabels[photo.view_angle]}</dd>
        <dt>Fichier</dt><dd>{photo.original_filename}</dd><dt>Description</dt><dd>{photo.description || "Non renseignée"}</dd><dt>Notes médicales</dt><dd>{photo.notes || "Non renseignées"}</dd>
        <dt>Importée par</dt><dd>{photo.uploaded_by_name || "Équipe du cabinet"}</dd><dt>Dimensions</dt><dd>{photo.width} × {photo.height} · {formatFileSize(photo.file_size)}</dd>
      </dl><div className={ui.actions}>
        {canWrite && !photo.is_archived && <button className={ui.action} onClick={onEdit}>Modifier les informations</button>}
        <button className={ui.action} disabled={busy} onClick={() => void download()}>{busy ? "Téléchargement…" : "Télécharger"}</button>
        {canWrite && !photo.is_archived && <button className={ui.action} onClick={onArchive}>{archiveLabel}</button>}
      </div>{error && <p role="alert">{error}</p>}</aside>
    </div>
    <footer className={styles.viewerHeader}><button className={ui.action} disabled={!previous} onClick={() => { setZoom(1); onPrevious(); }}>← Photo précédente</button><small>Flèches pour naviguer · Échap pour fermer</small><button className={ui.action} disabled={!next} onClick={() => { setZoom(1); onNext(); }}>Photo suivante →</button></footer>
  </dialog>;
}
