import { queryString } from "@/features/medical/services/query";
import { apiRequest } from "@/lib/api-client";
import type { MedicalAlert, MedicalAlertPayload, PaginatedResponse } from "../types";

export interface MedicalAlertListParams {
  patient?: number | string;
  category?: string;
  severity?: string;
  is_active?: boolean | "";
  ordering?: string;
}

export function listMedicalAlerts(params: MedicalAlertListParams = {}) {
  return apiRequest<PaginatedResponse<MedicalAlert>>(`medical-alerts/${queryString(params)}`);
}

export function createMedicalAlert(payload: MedicalAlertPayload) {
  return apiRequest<MedicalAlert>("medical-alerts/", { method: "POST", body: payload });
}

export function updateMedicalAlert(id: number | string, payload: Partial<MedicalAlertPayload> & { is_active?: boolean }) {
  return apiRequest<MedicalAlert>(`medical-alerts/${id}/`, { method: "PATCH", body: payload });
}

export function resolveMedicalAlert(id: number | string, resolutionNote = "") {
  return apiRequest<MedicalAlert>(`medical-alerts/${id}/resolve/`, {
    method: "POST",
    body: { resolution_note: resolutionNote },
  });
}
