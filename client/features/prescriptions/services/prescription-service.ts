import { queryString } from "@/features/medical/services/query";
import { apiRequest } from "@/lib/api-client";
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
  list: listPrescriptions,
  get: getPrescription,
  create: createPrescription,
  update: updatePrescription,
  delete: deletePrescription,
};
