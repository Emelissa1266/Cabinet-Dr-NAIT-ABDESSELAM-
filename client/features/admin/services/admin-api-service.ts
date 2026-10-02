import { apiRequest } from "@/lib/api-client";
import { queryString } from "@/features/medical/services/query";
import type { AppointmentType } from "@/features/agenda/types";
import type { BillableServiceApi } from "@/features/billing/api-types";
import type { CareCategoryApi, CareParameterDefinitionApi, CareTypeApi } from "@/features/care/api-types";
import type { DocumentCategoryApi } from "@/features/documents/api-types";
import type { InterventionTypeApi, PreoperativeChecklistItemApi } from "@/features/interventions/api-types";
import type {
  AdminUserApi,
  AdminUserPayload,
  ClinicClosureApi,
  ConfigListParams,
  PaginatedResponse,
  StaffTimeOffApi,
  StaffWorkingHoursApi,
} from "../api-types";

export function listAdminUsers(params: ConfigListParams = {}) {
  return apiRequest<PaginatedResponse<AdminUserApi>>(`auth/users/${queryString(params)}`);
}

export function createAdminUser(payload: AdminUserPayload) {
  return apiRequest<AdminUserApi>("auth/users/", { method: "POST", body: payload });
}

export function updateAdminUser(id: number | string, payload: AdminUserPayload) {
  return apiRequest<AdminUserApi>(`auth/users/${id}/`, { method: "PATCH", body: payload });
}

export function listConfig<T>(path: string, params: ConfigListParams = {}) {
  return apiRequest<PaginatedResponse<T>>(`${path}/${queryString(params)}`);
}

export function createConfig<T>(path: string, payload: object) {
  return apiRequest<T>(`${path}/`, { method: "POST", body: payload });
}

export function updateConfig<T>(path: string, id: number | string, payload: object) {
  return apiRequest<T>(`${path}/${id}/`, { method: "PATCH", body: payload });
}

export function deleteConfig(path: string, id: number | string) {
  return apiRequest<void>(`${path}/${id}/`, { method: "DELETE" });
}

export type AdminConfigResource =
  | CareCategoryApi
  | CareTypeApi
  | CareParameterDefinitionApi
  | AppointmentType
  | StaffWorkingHoursApi
  | StaffTimeOffApi
  | ClinicClosureApi
  | InterventionTypeApi
  | PreoperativeChecklistItemApi
  | BillableServiceApi
  | DocumentCategoryApi;
