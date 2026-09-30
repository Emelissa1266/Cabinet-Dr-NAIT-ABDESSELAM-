import { apiRequest } from "@/lib/api-client";
import type {
  Consultation,
  ConsultationListParams,
  ConsultationPayload,
  PaginatedResponse,
  UpdateConsultationPayload,
} from "../types";
import { queryString } from "./query";

export async function listConsultations(params: ConsultationListParams = {}) {
  return apiRequest<PaginatedResponse<Consultation>>(`consultations/${queryString(params)}`);
}

export async function getConsultation(id: number | string) {
  return apiRequest<Consultation>(`consultations/${id}/`);
}

export async function createConsultation(payload: ConsultationPayload) {
  return apiRequest<Consultation>("consultations/", { method: "POST", body: payload });
}

export async function updateConsultation(id: number | string, payload: UpdateConsultationPayload) {
  return apiRequest<Consultation>(`consultations/${id}/`, { method: "PATCH", body: payload });
}

export async function deleteConsultation(id: number | string) {
  await apiRequest<void>(`consultations/${id}/`, { method: "DELETE" });
}

export const consultationService = {
  list: listConsultations,
  get: getConsultation,
  create: createConsultation,
  update: updateConsultation,
  delete: deleteConsultation,
};
