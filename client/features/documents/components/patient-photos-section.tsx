"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import workspace from "@/components/ui/module-workspace.module.css";
import photoStyles from "@/features/phototheque/components/photo-library.module.css";
import type {
  ClinicalPhotoApi,
  ClinicalPhotoComparisonApi,
  ClinicalPhotoSetApi,
  ClinicalPhotoType,
} from "../api-types";
import { PrivateClinicalImage } from "./private-clinical-image";
import {
  archiveClinicalPhoto,
  createClinicalPhotoComparison,
  createClinicalPhotoSet,
  downloadBlob,
  fetchClinicalPhotoBlob,
  listClinicalPhotoComparisons,
  listClinicalPhotos,
  listClinicalPhotoSets,
  uploadClinicalPhoto,
} from "../services/document-api-service";
import {
  dateTime,
  formatFileSize,
  localDateTimeInput,
  photoTypeLabels,
  viewAngleLabels,
} from "../services/document-display";
import {
  buildPhotoSetPayload,
  buildPhotoUploadPayload,
  clinicalPhotoErrorMessage,
  patientPhotoSets,
  photoSetOptionLabel,
  photoSetsForUploadSelector,
  photoSetSelectState,
  upsertPhotoSet,
} from "../services/photo-workflow";

const photoTypes: ClinicalPhotoType[] = ["BEFORE", "AFTER", "PROGRESS", "OTHER"];

export function PatientPhotosSection({ patient }: { patient: Patient }) {
  const { user } = useAuth();
  const [sets, setSets] = useState<ClinicalPhotoSetApi[]>([]);
  const [photos, setPhotos] = useState<ClinicalPhotoApi[]>([]);
  const [comparisons, setComparisons] = useState<ClinicalPhotoComparisonApi[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSetId, setSelectedSetId] = useState("");
  const [filter, setFilter] = useState<ClinicalPhotoType | "">("");
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [seriesBusy, setSeriesBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [comparisonBusy, setComparisonBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [galleryError, setGalleryError] = useState("");
  const [seriesLoadError, setSeriesLoadError] = useState("");
  const [seriesError, setSeriesError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [comparisonError, setComparisonError] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const canWrite = user?.role === "DOCTOR" || user?.role === "NURSE";
  const selected = photos.find((photo) => photo.id === selectedId) ?? photos[0] ?? null;
  const uploadSeries = useMemo(() => photoSetsForUploadSelector(sets, filter), [filter, sets]);
  const uploadSeriesState = photoSetSelectState(uploadSeries, seriesLoading, seriesLoadError);
  const photoCountBySet = useMemo(() => {
    const counts = new Map<number, number>();
    photos.forEach((photo) => {
      if (photo.photo_set) counts.set(photo.photo_set, (counts.get(photo.photo_set) ?? 0) + 1);
    });
    return counts;
  }, [photos]);
  const photoLabel = useCallback(
    (photoId: number) => {
      const photo = photos.find((item) => item.id === photoId);
      if (!photo) return "Cliché archivé";
      return `${photoTypeLabels[photo.photo_type]} · ${photo.anatomical_area} · ${dateTime(photo.captured_at || photo.created_at)}`;
    },
    [photos],
  );

  const filtered = useMemo(
    () => photos.filter((photo) => !filter || photo.photo_type === filter),
    [filter, photos],
  );

  const load = useCallback(async (failureMessage = "Impossible de charger la photothèque.") => {
    setLoading(true);
    setSeriesLoading(true);
    setGalleryError("");
    setSeriesLoadError("");
    const [setResult, photoResult, comparisonResult] = await Promise.allSettled([
      listClinicalPhotoSets({ patient: patient.apiId }),
      listClinicalPhotos({ patient: patient.apiId }),
      listClinicalPhotoComparisons({ patient: patient.apiId }),
    ]);

    if (setResult.status === "fulfilled") {
      const nextSets = patientPhotoSets(setResult.value.results, patient.apiId);
      setSets(nextSets);
      setSelectedSetId((current) => (
        current && nextSets.some((set) => String(set.id) === current) ? current : ""
      ));
    } else {
      setSeriesLoadError(clinicalPhotoErrorMessage(setResult.reason, "Impossible de charger les séries."));
    }

    if (photoResult.status === "fulfilled") {
      setPhotos(photoResult.value.results);
      setSelectedId((current) => current ?? photoResult.value.results[0]?.id ?? null);
    } else {
      setGalleryError(clinicalPhotoErrorMessage(photoResult.reason, failureMessage));
    }

    if (comparisonResult.status === "fulfilled") {
      setComparisons(comparisonResult.value.results);
    } else if (photoResult.status === "fulfilled") {
      setGalleryError(clinicalPhotoErrorMessage(comparisonResult.reason, failureMessage));
    }

    setSeriesLoading(false);
    setLoading(false);
  }, [patient.apiId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitSet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    setSeriesBusy(true);
    setSeriesError("");
    setGalleryError("");
    setMessage("");
    let created: ClinicalPhotoSetApi | null = null;
    try {
      created = await createClinicalPhotoSet(buildPhotoSetPayload(patient.apiId, {
        title: form.get("title"),
        anatomical_area: form.get("anatomical_area"),
        captured_at: form.get("captured_at"),
        notes: form.get("notes"),
      }));
    } catch (cause) {
      setSeriesError(clinicalPhotoErrorMessage(cause, "Impossible de créer la série."));
      return;
    } finally {
      setSeriesBusy(false);
    }

    formElement.reset();
    setSets((current) => upsertPhotoSet(current, created));
    setSelectedSetId(String(created.id));
    setSeriesLoadError("");
    setMessage("Série créée avec succès.");
    await load("La série a été créée, mais la liste n’a pas pu être actualisée.");
  }

  async function submitPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const image = form.get("image");
    if (!(image instanceof File) || !image.name) {
      setPhotoError("Sélectionnez une image clinique.");
      return;
    }
    setPhotoBusy(true);
    setPhotoError("");
    setGalleryError("");
    setMessage("");
    let photo: ClinicalPhotoApi | null = null;
    try {
      photo = await uploadClinicalPhoto(buildPhotoUploadPayload(patient.apiId, {
        photo_type: form.get("photo_type"),
        anatomical_area: form.get("anatomical_area"),
        view_angle: form.get("view_angle"),
        photo_set: selectedSetId,
        captured_at: form.get("captured_at"),
        description: form.get("description"),
        notes: form.get("notes"),
      }, image));
    } catch (cause) {
      setPhotoError(clinicalPhotoErrorMessage(cause, "Impossible d’importer la photo."));
      return;
    } finally {
      setPhotoBusy(false);
    }

    formElement.reset();
    setSelectedId(photo.id);
    setMessage("Photo clinique importée dans le stockage privé.");
    await load("La photo a été importée, mais la photothèque n’a pas pu être actualisée.");
  }

  async function createComparison(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    setComparisonBusy(true);
    setComparisonError("");
    setGalleryError("");
    setMessage("");
    try {
      await createClinicalPhotoComparison({
        patient: patient.apiId,
        before_photo: String(form.get("before_photo") || ""),
        after_photo: String(form.get("after_photo") || ""),
        notes: String(form.get("notes") || "").trim(),
      });
    } catch (cause) {
      setComparisonError(clinicalPhotoErrorMessage(cause, "Impossible de créer la comparaison."));
      return;
    } finally {
      setComparisonBusy(false);
    }

    formElement.reset();
    setMessage("Comparaison enregistrée.");
    await load("La comparaison a été créée, mais la photothèque n’a pas pu être actualisée.");
  }

  async function archive(photo: ClinicalPhotoApi) {
    const reason = window.prompt("Motif d’archivage");
    if (!reason) return;
    setArchiveBusy(true);
    setArchiveError("");
    setGalleryError("");
    setMessage("");
    try {
      await archiveClinicalPhoto(photo.id, reason);
    } catch (cause) {
      setArchiveError(clinicalPhotoErrorMessage(cause, "Impossible d’archiver la photo."));
      return;
    } finally {
      setArchiveBusy(false);
    }

    setMessage("Photo archivée.");
    await load("La photo a été archivée, mais la photothèque n’a pas pu être actualisée.");
  }

  async function download(photo: ClinicalPhotoApi) {
    try {
      await downloadBlob(fetchClinicalPhotoBlob(photo.id, "download"), photo.original_filename || `photo-${photo.id}.jpg`);
    } catch (cause) {
      setArchiveError(clinicalPhotoErrorMessage(cause, "Impossible de télécharger la photo."));
    }
  }

  return (
    <section className={ui.panel}>
      <div className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Images privées</p>
          <h2>Photothèque clinique</h2>
        </div>
        <div className={ui.tabs}>
          {(["", ...photoTypes] as Array<ClinicalPhotoType | "">).map((value) => (
            <button key={value || "all"} className={ui.tab} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value ? photoTypeLabels[value] : "Toutes"}
            </button>
          ))}
        </div>
      </div>
      {message && <p className={workspace.feedback}>{message}</p>}
      {galleryError && <p role="alert">{galleryError}</p>}
      {canWrite && (
        <div className={workspace.twoColumns}>
          <form className={ui.form} onSubmit={submitSet}>
            <fieldset className={workspace.fieldset}>
              <legend>Nouvelle série</legend>
              <label>Titre<input name="title" required /></label>
              <label>Zone anatomique<input name="anatomical_area" required /></label>
              <label>Date de prise<input name="captured_at" type="datetime-local" defaultValue={localDateTimeInput()} /></label>
              <label>Notes<textarea name="notes" /></label>
              {seriesError && <p role="alert">{seriesError}</p>}
              <button className={ui.action} disabled={seriesBusy}>{seriesBusy ? "Création…" : "Créer série"}</button>
            </fieldset>
          </form>
          <form className={ui.form} onSubmit={submitPhoto}>
            <fieldset className={workspace.fieldset}>
              <legend>Importer une photo</legend>
              <label>Série
                <select
                  name="photo_set"
                  value={selectedSetId}
                  onChange={(event) => setSelectedSetId(event.target.value)}
                  disabled={seriesLoading}
                  aria-invalid={uploadSeriesState === "failed" || undefined}
                  aria-describedby="photo-series-status"
                >
                  <option value="">Sans série</option>
                  {uploadSeries.map((set) => <option key={set.id} value={set.id}>{photoSetOptionLabel(set)}</option>)}
                </select>
              </label>
              {uploadSeriesState === "loading" && <small id="photo-series-status" role="status">Chargement des séries…</small>}
              {uploadSeriesState === "empty" && <small id="photo-series-status">Aucune série créée pour ce patient.</small>}
              {uploadSeriesState === "failed" && <p id="photo-series-status" role="alert">{seriesLoadError}</p>}
              <label>Type
                <select name="photo_type" required>
                  {photoTypes.map((type) => <option key={type} value={type}>{photoTypeLabels[type]}</option>)}
                </select>
              </label>
              <label>Zone anatomique<input name="anatomical_area" required /></label>
              <label>Vue
                <select name="view_angle" defaultValue="OTHER">
                  {Object.entries(viewAngleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Date<input name="captured_at" type="datetime-local" defaultValue={localDateTimeInput()} /></label>
              <label>Image<input name="image" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" required /></label>
              <label>Description<textarea name="description" /></label>
              {photoError && <p role="alert">{photoError}</p>}
              <button className={`${ui.action} ${ui.primary}`} disabled={photoBusy}>{photoBusy ? "Import…" : "Importer photo"}</button>
            </fieldset>
          </form>
        </div>
      )}
      {loading ? <p role="status">Chargement des clichés…</p> : (
        <div className={workspace.twoColumns}>
          <div className={photoStyles.grid}>
            {sets.length > 0 && (
              <section className={workspace.section}>
                <h3>Séries</h3>
                <ul className={workspace.list}>
                  {sets.map((set) => {
                    const count = photoCountBySet.get(set.id) ?? 0;
                    return (
                      <li key={set.id}>
                        <strong>{set.title}</strong>
                        <small>{set.anatomical_area}{set.captured_at ? ` · ${dateTime(set.captured_at)}` : ""}</small>
                        <small>{count > 0 ? `${count} photo${count > 1 ? "s" : ""}` : "Aucune photo dans cette série."}</small>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {filtered.map((photo) => (
              <button
                key={photo.id}
                className={photoStyles.card}
                onClick={() => setSelectedId(photo.id)}
                aria-label={`Ouvrir ${photoTypeLabels[photo.photo_type]} ${photo.anatomical_area}`}
              >
                <div className={photoStyles.image}>
                  <PrivateClinicalImage
                    photoId={photo.id}
                    alt={`${photoTypeLabels[photo.photo_type]} ${photo.anatomical_area}`}
                  />
                  <span className={photoStyles.phase}><StatusBadge tone={photo.photo_type === "BEFORE" ? "neutral" : "teal"}>{photoTypeLabels[photo.photo_type]}</StatusBadge></span>
                </div>
                <div className={photoStyles.caption}>
                  <strong>{photo.anatomical_area}</strong>
                  <span>{dateTime(photo.captured_at || photo.created_at)}</span>
                  <small>{formatFileSize(photo.file_size)} · {photo.width}×{photo.height}</small>
                </div>
              </button>
            ))}
            {!filtered.length && <p className={ui.empty}>Aucun cliché pour ce patient.</p>}
          </div>
          <aside className={workspace.stack}>
            {selected ? (
              <section>
                <PrivateClinicalImage
                  className={photoStyles.viewer}
                  photoId={selected.id}
                  alt={`${photoTypeLabels[selected.photo_type]} ${selected.anatomical_area}`}
                />
                <dl>
                  <dt>Type</dt><dd>{photoTypeLabels[selected.photo_type]}</dd>
                  <dt>Zone</dt><dd>{selected.anatomical_area}</dd>
                  <dt>Vue</dt><dd>{viewAngleLabels[selected.view_angle]}</dd>
                  <dt>Date</dt><dd>{dateTime(selected.captured_at || selected.created_at)}</dd>
                  <dt>Fichier</dt><dd>{selected.original_filename}</dd>
                  <dt>Notes</dt><dd>{selected.notes || selected.description || "Aucune note."}</dd>
                </dl>
                <div className={ui.actions}>
                  <button className={ui.action} onClick={() => void download(selected)}>Télécharger</button>
                  {canWrite && <button className={ui.action} disabled={archiveBusy} onClick={() => void archive(selected)}>Archiver</button>}
                </div>
                {archiveError && <p role="alert">{archiveError}</p>}
              </section>
            ) : <p>Aucun cliché sélectionné.</p>}
            {canWrite && photos.some((photo) => photo.photo_type === "BEFORE") && photos.some((photo) => photo.photo_type !== "BEFORE") && (
              <form className={ui.form} onSubmit={createComparison}>
                <fieldset className={workspace.fieldset}>
                  <legend>Comparaison</legend>
                  <label>Avant
                    <select name="before_photo" required>
                      {photos.filter((photo) => photo.photo_type === "BEFORE").map((photo) => (
                        <option key={photo.id} value={photo.id}>{photo.anatomical_area} · {dateTime(photo.captured_at || photo.created_at)}</option>
                      ))}
                    </select>
                  </label>
                  <label>Après / évolution
                    <select name="after_photo" required>
                      {photos.filter((photo) => photo.photo_type === "AFTER" || photo.photo_type === "PROGRESS").map((photo) => (
                        <option key={photo.id} value={photo.id}>{photoTypeLabels[photo.photo_type]} · {photo.anatomical_area}</option>
                      ))}
                    </select>
                  </label>
                  <label>Notes<textarea name="notes" /></label>
                  {comparisonError && <p role="alert">{comparisonError}</p>}
                  <button className={ui.action} disabled={comparisonBusy}>Créer comparaison</button>
                </fieldset>
              </form>
            )}
            <section>
              <h3>Comparaisons enregistrées</h3>
              <ul className={workspace.list}>
                {comparisons.map((comparison) => (
                  <li key={comparison.id}>
                    <strong>{photoLabel(comparison.before_photo)} → {photoLabel(comparison.after_photo)}</strong>
                    <small>{dateTime(comparison.created_at)} · {comparison.notes || "Sans note"}</small>
                  </li>
                ))}
                {!comparisons.length && <li>Aucune comparaison persistée.</li>}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
