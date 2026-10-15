import type { ClinicalPhotoApi, ClinicalPhotoSetApi } from "@/features/documents/api-types";

export function validatePhotoFiles(files: File[], maxSize: number, mimeTypes: string[]) {
  if (!files.length) return "Sélectionnez au moins une photographie.";
  for (const file of files) {
    if (!mimeTypes.includes(file.type) || !/\.(jpe?g|png)$/i.test(file.name)) return `${file.name} : utilisez une image JPEG ou PNG.`;
    if (!file.size || file.size > maxSize) return `${file.name} : taille maximale ${(maxSize / 1024 / 1024).toFixed(0)} Mo.`;
  }
  return "";
}

// Keep only failed files for retries. An already persisted photo is never uploaded twice.
export async function importPhotoFiles<T>(files: File[], upload: (file: File) => Promise<T>, progress: (done: number, total: number) => void) {
  const created: T[] = [];
  const failed: Array<{ file: File; cause: unknown }> = [];
  progress(0, files.length);
  for (let index = 0; index < files.length; index++) {
    try { created.push(await upload(files[index])); }
    catch (cause) { failed.push({ file: files[index], cause }); }
    progress(index + 1, files.length);
  }
  return { created, failed };
}

export function adjacentPhoto(photos: ClinicalPhotoApi[], selectedId: number, direction: -1 | 1) {
  const index = photos.findIndex(photo => photo.id === selectedId);
  return index < 0 ? null : photos[index + direction] ?? null;
}

export function seriesForPatient(sets: ClinicalPhotoSetApi[], patient: string | number) {
  return sets.filter(set => String(set.patient) === String(patient));
}

export function toLocalCapture(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
