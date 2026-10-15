"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/components/auth-provider";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { PrivateClinicalImage } from "@/features/documents/components/private-clinical-image";
import type { ClinicalPhotoApi, ClinicalPhotoSetApi, ClinicalPhotoType } from "@/features/documents/api-types";
import { archiveClinicalPhoto, deleteClinicalPhotoSet, getClinicalPhoto, listClinicalPhotos, listClinicalPhotoSets } from "@/features/documents/services/document-api-service";
import { clinicalPhotoErrorMessage } from "@/features/documents/services/photo-workflow";
import { dateTime, photoTypeLabels } from "@/features/documents/services/document-display";
import { getPatient } from "@/features/patients/services/patient-service";
import { adjacentPhoto } from "../services/gallery-workflow";
import { PatientPicker, SeriesPicker } from "./gallery-pickers";
import { PhotoEditor, SeriesEditor } from "./gallery-editors";
import { PhotoViewer } from "./photo-viewer";
import { PhotoComparisons } from "./photo-comparisons";
import ui from "@/components/ui/clinical.module.css";
import styles from "./photo-gallery.module.css";

export function ClinicalGallery({ initialPatientId }: { initialPatientId?: string }) {
  const { user, ready } = useAuth();
  const allowed = Boolean(user && ["ADMIN", "DOCTOR", "NURSE"].includes(user.role));
  const canWrite = user?.role === "DOCTOR" || user?.role === "NURSE";
  const [patient, setPatient] = useState(initialPatientId && /^\d+$/.test(initialPatientId) ? initialPatientId : "");
  const [initialPatientError, setInitialPatientError] = useState("");
  const [initializing, setInitializing] = useState(Boolean(initialPatientId && !/^\d+$/.test(initialPatientId)));
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ClinicalPhotoType | "">("");
  const [date, setDate] = useState("");
  const [area, setArea] = useState("");
  const [ordering, setOrdering] = useState("recent");
  const [archived, setArchived] = useState(false);
  const [mode, setMode] = useState<"photos" | "albums">("photos");
  const [album, setAlbum] = useState<ClinicalPhotoSetApi | null>(null);
  const [seriesId, setSeriesId] = useState("");
  const [photos, setPhotos] = useState<ClinicalPhotoApi[]>([]);
  const [albums, setAlbums] = useState<ClinicalPhotoSetApi[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<ClinicalPhotoApi | null>(null);
  const [seriesEditor, setSeriesEditor] = useState<ClinicalPhotoSetApi | "new" | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [photoEditor, setPhotoEditor] = useState<ClinicalPhotoApi | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ photo?: ClinicalPhotoApi; series?: ClinicalPhotoSetApi } | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [busy, setBusy] = useState(false);
  const [comparisons, setComparisons] = useState(false);

  useEffect(() => {
    if (!allowed || !initialPatientId || /^\d+$/.test(initialPatientId)) return;
    let active = true;
    getPatient(initialPatientId).then(value => { if (active) setPatient(String(value.apiId)); })
      .catch(cause => { if (active) setInitialPatientError(clinicalPhotoErrorMessage(cause, "Patient introuvable.")); })
      .finally(() => { if (active) setInitializing(false); });
    return () => { active = false; };
  }, [allowed, initialPatientId]);

  useEffect(() => {
    if (!ready || !allowed || initializing || initialPatientError) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      const sort = ordering === "old" ? "captured_at,created_at" : ordering === "patient" ? "patient__last_name,patient__first_name,-captured_at" : ordering === "series" ? (mode === "photos" ? "photo_set__title,-captured_at" : "title,-captured_at") : "-captured_at,-created_at";
      try {
        const filters = { page, patient: patient || undefined, search: query, anatomical_area: area || undefined, captured_at__date: date || undefined, ordering: sort };
        const result = mode === "photos"
          ? await listClinicalPhotos({ ...filters, photo_type: category, photo_set: album?.id ?? (seriesId || undefined), is_archived: archived })
          : await listClinicalPhotoSets(filters);
        if (!active) return;
        if (mode === "photos") setPhotos(result.results as ClinicalPhotoApi[]);
        else setAlbums(result.results as ClinicalPhotoSetApi[]);
        setCount(result.count); setNext(Boolean(result.next));
      } catch (cause) { if (active) setError(clinicalPhotoErrorMessage(cause, "Impossible de charger la photothèque.")); }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [ready, allowed, initializing, initialPatientError, mode, page, patient, query, category, date, area, ordering, archived, album, seriesId, revision]);

  function refresh(text?: string) { setRevision(v => v + 1); if (text) setMessage(text); }
  function switchMode(value: "photos" | "albums") { setMode(value); setAlbum(null); setSeriesId(""); setPage(1); }
  function openAlbum(value: ClinicalPhotoSetApi) { setAlbum(value); setMode("photos"); setSeriesId(""); setCategory(""); setPage(1); setArchived(false); setQuery(""); setArea(""); setDate(""); }
  async function openPhoto(photo: ClinicalPhotoApi) {
    setBusy(true); setError("");
    try { setSelected(await getClinicalPhoto(photo.id)); }
    catch (cause) { setError(clinicalPhotoErrorMessage(cause, "Impossible d’ouvrir cette photographie.")); }
    finally { setBusy(false); }
  }
  function navigate(direction: -1 | 1) {
    if (!selected) return;
    const photo = adjacentPhoto(photos, selected.id, direction);
    if (photo) setSelected(photo);
  }
  async function confirmRemoval(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
    setBusy(true); setConfirmError("");
    try {
      if (confirm?.photo) await archiveClinicalPhoto(confirm.photo.id, reason);
      if (confirm?.series) await deleteClinicalPhotoSet(confirm.series.id);
      const text = confirm?.photo ? "Photo archivée ; le fichier reste conservé." : "Série vide supprimée.";
      setConfirm(null);
      if ((mode === "photos" ? photos : albums).length === 1 && page > 1) setPage(p => p - 1);
      refresh(text);
    } catch (cause) { setConfirmError(clinicalPhotoErrorMessage(cause, "Suppression refusée.")); }
    finally { setBusy(false); }
  }

  if (ready && !allowed) return <section className={ui.panel}><h1>Photothèque médicale</h1><p>Les photographies cliniques ne sont pas disponibles pour ce rôle.</p></section>;
  return <main className={`${ui.page} ${styles.page}`}>
    <header className={ui.heading}><div><p className={ui.eyebrow}>Imagerie médicale privée</p><h1 className={ui.title}>Photothèque médicale</h1><p className={ui.description}>Organisez et consultez les photographies médicales de vos patients.</p></div>
      {canWrite && <div className={ui.actions}><button className={ui.action} onClick={() => setSeriesEditor("new")}>+ Créer une série</button><button className={`${ui.action} ${ui.primary}`} onClick={() => setPhotoEditor("new")}>+ Ajouter une photo</button></div>}
    </header>
    <div className={styles.modeBar}><div className={ui.tabs}><button className={ui.tab} aria-pressed={mode === "photos" && !album} onClick={() => switchMode("photos")}>Toutes les photos</button><button className={ui.tab} aria-pressed={mode === "albums" || Boolean(album)} onClick={() => switchMode("albums")}>Par séries</button></div><button className={ui.action} onClick={() => setComparisons(true)}>Comparaisons avant / après</button></div>
    {album && <div className={styles.breadcrumb}><button onClick={() => switchMode("albums")}>Séries</button><span aria-hidden="true">/</span><strong>{album.title}</strong>{canWrite && <button className={ui.action} onClick={() => setSeriesEditor(album)}>Modifier la série</button>}</div>}
    <div className={`${ui.form} ${styles.filterHeader}`}>
      <label>Recherche<input type="search" placeholder="Patient, série, zone ou description…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
      <button className={ui.action} aria-expanded={showFilters} aria-controls="clinical-gallery-filters" onClick={() => setShowFilters(value => !value)}>Filtres et tri{[patient, seriesId, category, date, area, archived].filter(Boolean).length ? " · actifs" : ""}</button>
    </div>
    <section id="clinical-gallery-filters" hidden={!showFilters} className={`${ui.form} ${styles.filters}`} aria-label="Filtres de la galerie">
      {allowed && <PatientPicker value={patient} all onChange={value => { setPatient(value); setAlbum(null); setSeriesId(""); setPage(1); }} />}
      {allowed && mode === "photos" && !album && <SeriesPicker key={patient} patient={patient} value={seriesId} onChange={value => { setSeriesId(value); setPage(1); }} />}
      {mode === "photos" && <label>Catégorie<select value={category} onChange={e => { setCategory(e.target.value as ClinicalPhotoType | ""); setPage(1); }}><option value="">Toutes les catégories</option>{Object.entries(photoTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label>Date de prise<input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} /></label>
      <label>Zone anatomique<input value={area} onChange={e => { setArea(e.target.value); setPage(1); }} placeholder="Toutes les zones" /></label>
      <label>Trier par<select value={ordering} onChange={e => { setOrdering(e.target.value); setPage(1); }}><option value="recent">Plus récentes</option><option value="old">Plus anciennes</option><option value="patient">Patient</option><option value="series">Série</option></select></label>
      {mode === "photos" && <label>Conservation<select value={String(archived)} onChange={e => { setArchived(e.target.value === "true"); setPage(1); }}><option value="false">Photos actives</option><option value="true">Photos archivées</option></select></label>}
      <button className={ui.action} onClick={() => { setQuery(""); setPatient(""); setAlbum(null); setSeriesId(""); setCategory(""); setDate(""); setArea(""); setOrdering("recent"); setArchived(false); setPage(1); }}>Réinitialiser</button>
    </section>
    {initialPatientError && <p role="alert">{initialPatientError}</p>}
    {message && <p className={styles.feedback} role="status">{message}</p>}
    {error && <div className={ui.panel} role="alert">{error}<button className={ui.action} onClick={() => refresh()}>Réessayer</button></div>}
    {!initialPatientError && (loading || !ready || initializing ? <div role="status" className={styles.grid} aria-label="Chargement de la galerie">{Array.from({ length: 8 }, (_, index) => <div key={index} className={styles.skeleton} />)}</div> : !error && <>
      <p className={styles.resultCount}>{count} {mode === "photos" ? "photographie(s)" : "série(s)"}</p>
      <div className={styles.grid}>
        {mode === "photos" ? photos.map(photo => <button className={styles.card} key={photo.id} disabled={busy} onClick={() => void openPhoto(photo)} aria-label={`Ouvrir ${photo.description || photo.anatomical_area} · ${photo.patient_name || photo.patient_reference}`}>
          <div className={styles.thumbnail}><PrivateClinicalImage photoId={photo.id} thumbnail alt={`${photoTypeLabels[photo.photo_type]} · ${photo.anatomical_area}`} /><span className={styles.badge}><StatusBadge tone={photo.photo_type === "BEFORE" ? "neutral" : "teal"}>{photoTypeLabels[photo.photo_type]}</StatusBadge></span></div>
          <div className={styles.caption}><strong>{photo.patient_name || photo.patient_reference}</strong><span>{photo.photo_set_title || "Sans série"}</span><small>{dateTime(photo.captured_at || photo.created_at)}</small><small>{photo.anatomical_area}</small></div>
        </button>) : albums.map(set => <article className={styles.album} key={set.id}>
          <button className={styles.albumOpen} onClick={() => openAlbum(set)} aria-label={`Ouvrir la série ${set.title}`}><div className={styles.thumbnail}>{set.cover_photo ? <PrivateClinicalImage photoId={set.cover_photo} thumbnail alt={`Couverture de ${set.title}`} /> : <span className={styles.albumEmpty}>Série sans photographie</span>}</div><div className={styles.caption}><strong>{set.title}</strong><span>{set.patient_name || set.patient_reference}</span><small>{set.photo_count ?? 0} photo(s) · {set.anatomical_area}</small><small>{dateTime(set.captured_at || set.created_at)}</small></div></button>
          {canWrite && <div className={styles.albumActions}><button className={ui.action} onClick={() => setSeriesEditor(set)}>Modifier</button><button className={ui.action} disabled={Boolean(set.photo_count)} onClick={() => { setConfirmError(""); setConfirm({ series: set }); }}>Supprimer la série vide</button></div>}
        </article>)}
      </div>
      {!count && <section className={`${ui.panel} ${styles.empty}`}><h2>{mode === "albums" ? "Aucune série" : "Aucune photographie"}</h2><p>{album ? "Ajoutez les premières photographies à cette série." : "Aucun résultat ne correspond à vos filtres."}</p>{canWrite && <button className={`${ui.action} ${ui.primary}`} onClick={() => mode === "albums" ? setSeriesEditor("new") : setPhotoEditor("new")}>{mode === "albums" ? "+ Créer une série" : "+ Ajouter une photo"}</button>}</section>}
      <footer className={ui.footer}><span>{count} résultat(s)</span><div className={ui.actions}><button className={ui.action} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</button><span>Page {page}</span><button className={ui.action} disabled={!next} onClick={() => setPage(p => p + 1)}>Suivant</button></div></footer>
    </>)}
    {selected && <PhotoViewer photo={selected} canWrite={canWrite} previous={Boolean(adjacentPhoto(photos, selected.id, -1))} next={Boolean(adjacentPhoto(photos, selected.id, 1))} onPrevious={() => navigate(-1)} onNext={() => navigate(1)} onClose={() => setSelected(null)} onEdit={() => { setPhotoEditor(selected); setSelected(null); }} onArchive={() => { setConfirmError(""); setConfirm({ photo: selected }); setSelected(null); }} />}
    <DetailDialog title={seriesEditor === "new" ? "Créer une série" : "Modifier la série"} open={Boolean(seriesEditor)} onClose={() => { if (!editorBusy) setSeriesEditor(null); }}>{seriesEditor && <SeriesEditor onBusy={setEditorBusy} series={seriesEditor === "new" ? undefined : seriesEditor} patientId={patient} onCancel={() => setSeriesEditor(null)} onSave={value => { const created = seriesEditor === "new"; setSeriesEditor(null); if (created) { setPatient(String(value.patient)); openAlbum(value); } else if (album?.id === value.id) setAlbum(value); refresh(created ? "Série créée. Vous pouvez y ajouter des photos." : "Série modifiée."); }} />}</DetailDialog>
    <DetailDialog title={photoEditor === "new" ? "Ajouter des photos" : "Modifier la photographie"} open={Boolean(photoEditor)} onClose={() => { if (!editorBusy) setPhotoEditor(null); }}>{photoEditor && <PhotoEditor onBusy={setEditorBusy} photo={photoEditor === "new" ? undefined : photoEditor} patientId={patient} series={album ?? undefined} onCancel={() => setPhotoEditor(null)} onPartial={() => refresh("Les photos importées avec succès sont disponibles.")} onSave={saved => { const created = photoEditor === "new"; setPhotoEditor(null); if (created) { if (saved) { setPatient(String(saved.patient)); if (album?.id !== saved.photo_set) setAlbum(null); setSeriesId(""); } setPage(1); setMode("photos"); setCategory(""); setDate(""); setArea(""); setQuery(""); setArchived(false); setOrdering("recent"); } refresh(created ? "Photographies importées dans la galerie privée." : "Photographie modifiée."); }} />}</DetailDialog>
    <DetailDialog title={confirm?.photo ? "Supprimer de la galerie" : "Supprimer la série vide"} open={Boolean(confirm)} onClose={() => { if (!busy) setConfirm(null); }}>
      <form className={ui.form} onSubmit={confirmRemoval}><p>{confirm?.photo ? "Voulez-vous retirer cette photo de la galerie ? Elle sera archivée ; le fichier original et l’historique médical resteront conservés." : "Voulez-vous supprimer cette série vide ? Cette action est irréversible. Une série contenant des photos, même archivées, ne peut pas être supprimée."}</p>{confirm?.photo && <label>Motif d’archivage<textarea name="reason" required disabled={busy} /></label>}{confirmError && <p role="alert">{confirmError}</p>}<div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Enregistrement…" : "Confirmer"}</button><button type="button" className={ui.action} disabled={busy} onClick={() => setConfirm(null)}>Annuler</button></div></form>
    </DetailDialog>
    <DetailDialog title="Comparaisons avant / après" open={comparisons} onClose={() => setComparisons(false)}>{comparisons && <PhotoComparisons patientId={patient} canWrite={canWrite} />}</DetailDialog>
  </main>;
}
