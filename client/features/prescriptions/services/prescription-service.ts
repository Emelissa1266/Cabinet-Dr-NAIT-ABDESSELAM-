import { queryString } from "@/features/medical/services/query";
import { apiBlobRequest, apiRequest } from "@/lib/api-client";
import type {
  Prescription,
  PrescriptionListParams,
  PrescriptionPage,
  PrescriptionPayload,
  UpdatePrescriptionPayload,
} from "../types";

export async function listPrescriptions(params: PrescriptionListParams = {}) {
  return apiRequest<PrescriptionPage>(`prescriptions/${queryString(params)}`);
}

export async function listAllPrescriptions(params: Omit<PrescriptionListParams, "page"> = {}) {
  const results: Prescription[] = [];
  let page = 1;
  let response: PrescriptionPage;
  do {
    response = await listPrescriptions({ ...params, page: page++ });
    results.push(...response.results);
  } while (response.next);
  return { count: results.length, next: null, previous: null, results };
}

export function getPrescriptionPdf(id: number | string) {
  return apiBlobRequest(`prescriptions/${id}/pdf/`, { cache: "no-store" });
}

export function getPrescriptionPrintPdf(id: number | string) {
  return apiBlobRequest(`prescriptions/${id}/print/`, { cache: "no-store" });
}

export async function getPrescription(id: number | string) {
  return apiRequest<Prescription>(`prescriptions/${id}/`);
}

export async function createPrescription(payload: PrescriptionPayload) {
  return apiRequest<Prescription>("prescriptions/", { method: "POST", body: payload });
}

export async function updatePrescription(id: number | string, payload: UpdatePrescriptionPayload) {
  return apiRequest<Prescription>(`prescriptions/${id}/`, { method: "PATCH", body: payload });
}

export async function deletePrescription(id: number | string) {
  await apiRequest<void>(`prescriptions/${id}/`, { method: "DELETE" });
}

export const prescriptionService = {
  list: listAllPrescriptions,
  get: getPrescription,
  create: createPrescription,
  update: updatePrescription,
  delete: deletePrescription,
};
