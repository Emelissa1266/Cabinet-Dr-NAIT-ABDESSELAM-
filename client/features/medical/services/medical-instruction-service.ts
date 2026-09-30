import { apiRequest } from "@/lib/api-client";
import type {
  MedicalInstruction,
  MedicalInstructionListParams,
  MedicalInstructionPayload,
  PaginatedResponse,
  UpdateMedicalInstructionPayload,
} from "../types";
import { queryString } from "./query";

export async function listMedicalInstructions(params: MedicalInstructionListParams = {}) {
  return apiRequest<PaginatedResponse<MedicalInstruction>>(`medical-instructions/${queryString(params)}`);
}

export async function getMedicalInstruction(id: number | string) {
  return apiRequest<MedicalInstruction>(`medical-instructions/${id}/`);
}

export async function createMedicalInstruction(payload: MedicalInstructionPayload) {
  return apiRequest<MedicalInstruction>("medical-instructions/", { method: "POST", body: payload });
}

export async function updateMedicalInstruction(id: number | string, payload: UpdateMedicalInstructionPayload) {
  return apiRequest<MedicalInstruction>(`medical-instructions/${id}/`, { method: "PATCH", body: payload });
}

export async function deleteMedicalInstruction(id: number | string) {
  await apiRequest<void>(`medical-instructions/${id}/`, { method: "DELETE" });
}

export const medicalInstructionService = {
  list: listMedicalInstructions,
  get: getMedicalInstruction,
  create: createMedicalInstruction,
  update: updateMedicalInstruction,
  delete: deleteMedicalInstruction,
};
