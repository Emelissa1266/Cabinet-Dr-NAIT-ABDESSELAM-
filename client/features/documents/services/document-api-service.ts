import { apiBlobRequest, apiRequest, type ApiBlobResponse } from "@/lib/api-client";
import { queryString } from "@/features/medical/services/query";
import type {
  ClinicalPhotoApi,
  ClinicalPhotoComparisonApi,
  ClinicalPhotoComparisonListParams,
  ClinicalPhotoListParams,
  ClinicalPhotoSetApi,
  ClinicalPhotoSetListParams,
  CreateClinicalPhotoComparisonPayload,
  CreateClinicalPhotoPayload,
  CreateClinicalPhotoSetPayload,
  CreateDocumentPayload,
  DocumentApi,
  DocumentCategoryApi,
  DocumentCategoryListParams,
  DocumentListParams,
  PaginatedResponse,
} from "../api-types";

type UploadValue = File | string | number | boolean | null | undefined;

function formData(payload: object) {
  const data = new FormData();
  for (const [key, value] of Object.entries(payload) as [string, UploadValue][]) {
    if (value === undefined || value === null || value === "") continue;
    data.set(key, value instanceof File ? value : String(value));
  }
  return data;
}

export function listDocumentCategories(params: DocumentCategoryListParams = {}) {
  return apiRequest<PaginatedResponse<DocumentCategoryApi>>(`document-categories/${queryString(params)}`);
}

export function listDocuments(params: DocumentListParams = {}) {
  return apiRequest<PaginatedResponse<DocumentApi>>(`documents/${queryString(params)}`);
}

export function getDocument(id: number | string) {
  return apiRequest<DocumentApi>(`documents/${id}/`);
}

export function uploadDocument(payload: CreateDocumentPayload) {
  return apiRequest<DocumentApi>("documents/", { method: "POST", body: formData(payload) });
}

export function updateDocument(id: number | string, payload: Partial<Omit<CreateDocumentPayload, "file">>) {
  return apiRequest<DocumentApi>(`documents/${id}/`, { method: "PATCH", body: payload });
}

export function archiveDocument(id: number | string, reason: string) {
  return apiRequest<DocumentApi>(`documents/${id}/archive/`, { method: "POST", body: { reason } });
}

export function fetchDocumentBlob(id: number | string, mode: "download" | "view" = "download") {
  return apiBlobRequest(`documents/${id}/${mode}/`);
}

export function listClinicalPhotoSets(params: ClinicalPhotoSetListParams = {}) {
  return apiRequest<PaginatedResponse<ClinicalPhotoSetApi>>(`clinical-photo-sets/${queryString(params)}`);
}

export function createClinicalPhotoSet(payload: CreateClinicalPhotoSetPayload) {
  return apiRequest<ClinicalPhotoSetApi>("clinical-photo-sets/", { method: "POST", body: payload });
}

export function updateClinicalPhotoSet(id: number | string, payload: Partial<Omit<CreateClinicalPhotoSetPayload, "captured_at">> & { captured_at?: string | null }) {
  return apiRequest<ClinicalPhotoSetApi>(`clinical-photo-sets/${id}/`, { method: "PATCH", body: payload });
}

export function listClinicalPhotos(params: ClinicalPhotoListParams = {}) {
  return apiRequest<PaginatedResponse<ClinicalPhotoApi>>(`clinical-photos/${queryString(params)}`);
}

export function getClinicalPhoto(id: number | string) {
  return apiRequest<ClinicalPhotoApi>(`clinical-photos/${id}/`);
}

export function uploadClinicalPhoto(payload: CreateClinicalPhotoPayload) {
  return apiRequest<ClinicalPhotoApi>("clinical-photos/", { method: "POST", body: formData(payload) });
}

export function updateClinicalPhoto(id: number | string, payload: Partial<Omit<CreateClinicalPhotoPayload, "image" | "photo_set" | "captured_at">> & { photo_set?: number | string | null; captured_at?: string | null }) {
  return apiRequest<ClinicalPhotoApi>(`clinical-photos/${id}/`, { method: "PATCH", body: payload });
}

export function archiveClinicalPhoto(id: number | string, reason: string) {
  return apiRequest<ClinicalPhotoApi>(`clinical-photos/${id}/archive/`, { method: "POST", body: { reason } });
}

export function fetchClinicalPhotoBlob(id: number | string, mode: "download" | "view" | "thumbnail" = "view") {
  return apiBlobRequest(`clinical-photos/${id}/${mode}/`);
}

export function listClinicalPhotoComparisons(params: ClinicalPhotoComparisonListParams = {}) {
  return apiRequest<PaginatedResponse<ClinicalPhotoComparisonApi>>(`clinical-photo-comparisons/${queryString(params)}`);
}

export function createClinicalPhotoComparison(payload: CreateClinicalPhotoComparisonPayload) {
  return apiRequest<ClinicalPhotoComparisonApi>("clinical-photo-comparisons/", { method: "POST", body: payload });
}

export function updateClinicalPhotoComparison(
  id: number | string,
  payload: Partial<CreateClinicalPhotoComparisonPayload>,
) {
  return apiRequest<ClinicalPhotoComparisonApi>(`clinical-photo-comparisons/${id}/`, { method: "PATCH", body: payload });
}

export async function downloadBlob(response: Promise<ApiBlobResponse>, fallbackFilename: string) {
  const result = await response;
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFromHeaders(result.headers) || fallbackFilename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function filenameFromHeaders(headers: Headers) {
  const disposition = headers.get("Content-Disposition") ?? headers.get("content-disposition") ?? "";
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return safeFilename(decodeURIComponent(utfMatch[1]));
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ? safeFilename(match[1]) : "";
}

export function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "document";
}

export function deleteClinicalPhotoSet(id: number) {
  return apiRequest<void>(`clinical-photo-sets/${id}/`, { method: "DELETE" });
}
export function clinicalPhotoUploadRules() {
  return apiRequest<{ max_size: number; mime_types: string[] }>("clinical-photos/upload-rules/");
}
