import type { ClinicalPhotoApi } from "../api-types";
import { listClinicalPhotos } from "./document-api-service";

// Locate the selected photo without loading every photo of the patient's dossier.
export async function photoSeriesWindow(photo: ClinicalPhotoApi, patient: string, list = listClinicalPhotos) {
  if (!photo.photo_set) return { photos: [photo], page: 1, next: false };
  let page = 1;
  while (true) {
    const result = await list({ patient, photo_set: photo.photo_set, page, ordering: "-captured_at,-created_at" });
    if (result.results.some(item => item.id === photo.id)) return { photos: result.results, page, next: Boolean(result.next) };
    if (!result.next) return { photos: [photo], page: 1, next: false };
    page += 1;
  }
}
