import { mockPhotos } from "../data/mock-photos";
import type { ClinicalPhoto } from "../types";
export interface PhotoService { list(): Promise<ClinicalPhoto[]> }
/** Public local assets are fixtures only. Replace with authenticated metadata and
 * short-lived private media URLs when the Django service is introduced.
 * Never place real patient photographs in public/. */
export const photoService: PhotoService = { async list() { return structuredClone(mockPhotos); } };
