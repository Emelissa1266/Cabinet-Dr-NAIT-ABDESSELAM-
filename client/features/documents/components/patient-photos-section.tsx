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
  ClinicalPhotoViewAngle,
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
  documentErrorMessage,
  formatFileSize,
  localDateTimeInput,
  photoTypeLabels,
  toIsoFromLocalInput,
  viewAngleLabels,
} from "../services/document-display";

const photoTypes: ClinicalPhotoType[] = ["BEFORE", "AFTER", "PROGRESS", "OTHER"];

export function PatientPhotosSection({ patient }: { patient: Patient }) {
  const { user } = useAuth();
  const [sets, setSets] = useState<ClinicalPhotoSetApi[]>([]);
  const [photos, setPhotos] = useState<ClinicalPhotoApi[]>([]);
  const [comparisons, setComparisons] = useState<ClinicalPhotoComparisonApi[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<ClinicalPhotoType | "">("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canWrite = user?.role === "DOCTOR" || user?.role === "NURSE";
  const selected = photos.find((photo) => photo.id === selectedId) ?? photos[0] ?? null;

  const filtered = useMemo(
    () => photos.filter((photo) => !filter || photo.photo_type === filter),
    [filter, photos],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [setPage, photoPage, comparisonPage] = await Promise.all([
        listClinicalPhotoSets({ patient: patient.apiId }),
        listClinicalPhotos({ patient: patient.apiId }),
        listClinicalPhotoComparisons({ patient: patient.apiId }),
      ]);
      setSets(setPage.results);
      setPhotos(photoPage.results);
      setComparisons(comparisonPage.results);
      setSelectedId((current) => current ?? photoPage.results[0]?.id ?? null);
    } catch (cause) {
      setError(documentErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [patient.apiId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitSet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await createClinicalPhotoSet({
        patient: patient.apiId,
        title: String(form.get("title") || "").trim(),
        anatomical_area: String(form.get("anatomical_area") || "").trim(),
        captured_at: toIsoFromLocalInput(form.get("captured_at")),
        notes: String(form.get("notes") || "").trim(),
      });
      event.currentTarget.reset();
      setMessage("Série photo créée.");
      await load();
    } catch (cause) {
      setError(documentErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const image = form.get("image");
    if (!(image instanceof File) || !image.name) {
      setError("Sélectionnez une image clinique.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const photo = await uploadClinicalPhoto({
        patient: patient.apiId,
        image,
        photo_type: String(form.get("photo_type") || "BEFORE") as ClinicalPhotoType,
        anatomical_area: String(form.get("anatomical_area") || "").trim(),
        view_angle: String(form.get("view_angle") || "OTHER") as ClinicalPhotoViewAngle,
        photo_set: String(form.get("photo_set") || ""),
        captured_at: toIsoFromLocalInput(form.get("captured_at")),
        description: String(form.get("description") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
      });
      event.currentTarget.reset();
      setSelectedId(photo.id);
      setMessage("Photo clinique importée dans le stockage privé.");
      await load();
    } catch (cause) {
      setError(documentErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createComparison(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await createClinicalPhotoComparison({
        patient: patient.apiId,
        before_photo: String(form.get("before_photo") || ""),
        after_photo: String(form.get("after_photo") || ""),
        notes: String(form.get("notes") || "").trim(),
      });
      event.currentTarget.reset();
      setMessage("Comparaison enregistrée.");
      await load();
    } catch (cause) {
      setError(documentErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function archive(photo: ClinicalPhotoApi) {
    const reason = window.prompt("Motif d’archivage");
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      await archiveClinicalPhoto(photo.id, reason);
      setMessage("Photo archivée.");
      await load();
    } catch (cause) {
      setError(documentErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function download(photo: ClinicalPhotoApi) {
    try {
      await downloadBlob(fetchClinicalPhotoBlob(photo.id, "download"), photo.original_filename || `photo-${photo.id}.jpg`);
    } catch (cause) {
      setError(documentErrorMessage(cause));
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
      {error && <p role="alert">{error}</p>}
      {canWrite && (
        <div className={workspace.twoColumns}>
          <form className={ui.form} onSubmit={submitSet}>
            <fieldset className={workspace.fieldset}>
              <legend>Nouvelle série</legend>
              <label>Titre<input name="title" required /></label>
              <label>Zone anatomique<input name="anatomical_area" required /></label>
              <label>Date de prise<input name="captured_at" type="datetime-local" defaultValue={localDateTimeInput()} /></label>
              <label>Notes<textarea name="notes" /></label>
              <button className={ui.action} disabled={busy}>Créer série</button>
            </fieldset>
          </form>
          <form className={ui.form} onSubmit={submitPhoto}>
            <fieldset className={workspace.fieldset}>
              <legend>Importer une photo</legend>
              <label>Série
                <select name="photo_set">
                  <option value="">Sans série</option>
                  {sets.map((set) => <option key={set.id} value={set.id}>{set.title}</option>)}
                </select>
              </label>
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
              <button className={`${ui.action} ${ui.primary}`} disabled={busy}>Importer photo</button>
            </fieldset>
          </form>
        </div>
      )}
      {loading ? <p role="status">Chargement des clichés…</p> : (
        <div className={workspace.twoColumns}>
          <div className={photoStyles.grid}>
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
            {!filtered.length && <p className={ui.empty}>Aucun cliché réel pour ce patient.</p>}
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
                  {canWrite && <button className={ui.action} disabled={busy} onClick={() => void archive(selected)}>Archiver</button>}
                </div>
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
                  <button className={ui.action} disabled={busy}>Créer comparaison</button>
                </fieldset>
              </form>
            )}
            <section>
              <h3>Comparaisons enregistrées</h3>
              <ul className={workspace.list}>
                {comparisons.map((comparison) => (
                  <li key={comparison.id}>
                    <strong>#{comparison.before_photo} → #{comparison.after_photo}</strong>
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
