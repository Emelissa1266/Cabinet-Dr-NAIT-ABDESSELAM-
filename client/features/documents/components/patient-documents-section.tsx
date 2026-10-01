"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import type { Patient } from "@/features/patients/types";
import ui from "@/components/ui/clinical.module.css";
import workspace from "@/components/ui/module-workspace.module.css";
import type { DocumentApi, DocumentCategoryApi } from "../api-types";
import {
  archiveDocument,
  downloadBlob,
  fetchDocumentBlob,
  listDocumentCategories,
  listDocuments,
  uploadDocument,
} from "../services/document-api-service";
import {
  checksumPreview,
  dateOnly,
  dateTime,
  documentErrorMessage,
  documentSystemLabels,
  formatFileSize,
} from "../services/document-display";

export function PatientDocumentsSection({ patient }: { patient: Patient }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentApi[]>([]);
  const [categories, setCategories] = useState<DocumentCategoryApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUpload = user?.role === "DOCTOR" || user?.role === "SECRETARY";
  const canArchive = user?.role === "DOCTOR" || user?.role === "SECRETARY";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [documentPage, categoryPage] = await Promise.all([
        listDocuments({ patient: patient.apiId, is_archived: showArchived ? true : "" }),
        listDocumentCategories({ is_active: true }),
      ]);
      setDocuments(documentPage.results);
      setCategories(categoryPage.results);
    } catch (cause) {
      setError(documentErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [patient.apiId, showArchived]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) {
      setError("Sélectionnez un fichier.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await uploadDocument({
        patient: patient.apiId,
        category: String(form.get("category") || ""),
        title: String(form.get("title") || file.name).trim(),
        description: String(form.get("description") || "").trim(),
        document_date: String(form.get("document_date") || ""),
        file,
      });
      event.currentTarget.reset();
      setMessage("Document importé dans le stockage privé.");
      await load();
    } catch (cause) {
      setError(documentErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function download(document: DocumentApi, mode: "download" | "view") {
    setError("");
    try {
      const response = fetchDocumentBlob(document.id, mode);
      if (mode === "view") {
        const result = await response;
        const url = URL.createObjectURL(result.blob);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        await downloadBlob(response, document.original_filename || `document-${document.id}`);
      }
    } catch (cause) {
      setError(documentErrorMessage(cause));
    }
  }

  async function archive(document: DocumentApi) {
    const reason = window.prompt("Motif d’archivage");
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      await archiveDocument(document.id, reason);
      setMessage("Document archivé.");
      await load();
    } catch (cause) {
      setError(documentErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={ui.panel}>
      <div className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Stockage privé</p>
          <h2>Documents</h2>
        </div>
        <button className={ui.action} onClick={() => setShowArchived((value) => !value)}>
          {showArchived ? "Masquer archives" : "Voir archives"}
        </button>
      </div>
      {message && <p className={workspace.feedback}>{message}</p>}
      {error && <p role="alert">{error}</p>}
      {canUpload && (
        <form className={ui.form} onSubmit={submit}>
          <div className={ui.toolbar}>
            <label>Catégorie
              <select name="category" required>
                <option value="">Sélectionner</option>
                {categories
                  .filter((category) => user?.role !== "SECRETARY" || ["ADMINISTRATIVE", "CONSENT"].includes(category.system_type))
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} · {documentSystemLabels[category.system_type]}
                    </option>
                  ))}
              </select>
            </label>
            <label>Date
              <input name="document_date" type="date" />
            </label>
            <label>Fichier
              <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required />
            </label>
          </div>
          <label>Titre
            <input name="title" maxLength={180} required />
          </label>
          <label>Description
            <textarea name="description" />
          </label>
          <button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Import…" : "Importer"}</button>
        </form>
      )}
      {loading ? <p role="status">Chargement des documents…</p> : (
        <ul className={workspace.list}>
          {documents.map((document) => (
            <li key={document.id}>
              <strong>{document.title}</strong>
              <small>
                {document.category_name} · {dateOnly(document.document_date)} · {formatFileSize(document.file_size)}
              </small>
              <small>
                {document.original_filename} · {document.mime_type} · SHA-256 {checksumPreview(document.checksum)}
              </small>
              <small>Importé le {dateTime(document.uploaded_at)} par {document.uploaded_by_name || "Utilisateur"}</small>
              {document.is_archived && <StatusBadge tone="neutral">Archivé · {document.archive_reason}</StatusBadge>}
              <div className={ui.actions}>
                <button className={ui.action} onClick={() => void download(document, "view")}>Voir</button>
                <button className={ui.action} onClick={() => void download(document, "download")}>Télécharger</button>
                {canArchive && !document.is_archived && (
                  <button className={ui.action} disabled={busy} onClick={() => void archive(document)}>Archiver</button>
                )}
              </div>
            </li>
          ))}
          {!documents.length && <li>Aucun document réel disponible pour ce patient.</li>}
        </ul>
      )}
    </section>
  );
}
