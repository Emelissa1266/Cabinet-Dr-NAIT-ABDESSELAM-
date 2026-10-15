import { collectCarePages } from "./care-pagination";
import { apiRequest } from "@/lib/api-client";
import { queryString } from "@/features/medical/services/query";
import type {
  CareApi,
  CareCategoryApi,
  CareCategoryListParams,
  CareListParams,
  CareObservationApi,
  CareObservationListParams,
  CareParameterDefinitionApi,
  CareParameterDefinitionListParams,
  CareSessionApi,
  CareSessionListParams,
  CareSessionMaterialApi,
  CareSessionMaterialListParams,
  CareSessionParameterApi,
  CareSessionParameterListParams,
  CareTypeApi,
  CareTypeListParams,
  ClinicalMeasurementApi,
  ClinicalMeasurementListParams,
  CreateCareObservationPayload,
  CreateCarePayload,
  CreateCareSessionMaterialPayload,
  CreateCareSessionParameterPayload,
  CreateCareSessionPayload,
  CreateClinicalMeasurementPayload,
  PaginatedResponse,
  UpdateCareObservationPayload,
  UpdateCarePayload,
  UpdateCareSessionMaterialPayload,
  UpdateCareSessionParameterPayload,
  UpdateCareSessionPayload,
  UpdateClinicalMeasurementPayload,
} from "../api-types";

export function listCareCategories(params: CareCategoryListParams = {}) {
  return apiRequest<PaginatedResponse<CareCategoryApi>>(`care-categories/${queryString(params)}`);
}

export function listCareTypes(params: CareTypeListParams = {}) {
  return apiRequest<PaginatedResponse<CareTypeApi>>(`care-types/${queryString(params)}`);
}

export function listCares(params: CareListParams = {}) {
  return apiRequest<PaginatedResponse<CareApi>>(`cares/${queryString(params)}`, { cache: "no-store" });
}

export function listAllCares(params: Omit<CareListParams, "page"> = {}) {
  return collectCarePages((page) => listCares({ ...params, page }));
}

export function listAllCareSessions(params: Omit<CareSessionListParams, "page"> = {}) {
  return collectCarePages((page) => listCareSessions({ ...params, page }));
}

export function getCare(id: number | string) {
  return apiRequest<CareApi>(`cares/${id}/`);
}

export function createCare(payload: CreateCarePayload) {
  return apiRequest<CareApi>("cares/", { method: "POST", body: payload });
}

export function updateCare(id: number | string, payload: UpdateCarePayload) {
  return apiRequest<CareApi>(`cares/${id}/`, { method: "PATCH", body: payload });
}

export function deleteCare(id: number | string) {
  return apiRequest<void>(`cares/${id}/`, { method: "DELETE" });
}

export function listCareSessions(params: CareSessionListParams = {}) {
  return apiRequest<PaginatedResponse<CareSessionApi>>(`care-sessions/${queryString(params)}`, { cache: "no-store" });
}

export function getCareSession(id: number | string) {
  return apiRequest<CareSessionApi>(`care-sessions/${id}/`);
}

export function createCareSession(payload: CreateCareSessionPayload) {
  return apiRequest<CareSessionApi>("care-sessions/", { method: "POST", body: payload });
}

export function updateCareSession(id: number | string, payload: UpdateCareSessionPayload) {
  return apiRequest<CareSessionApi>(`care-sessions/${id}/`, { method: "PATCH", body: payload });
}

export function startCareSession(id: number | string) {
  return apiRequest<CareSessionApi>(`care-sessions/${id}/start/`, { method: "POST" });
}

export function completeCareSession(id: number | string) {
  return apiRequest<CareSessionApi>(`care-sessions/${id}/complete/`, { method: "POST" });
}

export function listCareObservations(params: CareObservationListParams = {}) {
  return apiRequest<PaginatedResponse<CareObservationApi>>(`care-observations/${queryString(params)}`);
}

export function createCareObservation(payload: CreateCareObservationPayload) {
  return apiRequest<CareObservationApi>("care-observations/", { method: "POST", body: payload });
}

export function updateCareObservation(id: number | string, payload: UpdateCareObservationPayload) {
  return apiRequest<CareObservationApi>(`care-observations/${id}/`, { method: "PATCH", body: payload });
}

export function deleteCareObservation(id: number | string) {
  return apiRequest<void>(`care-observations/${id}/`, { method: "DELETE" });
}

export function listClinicalMeasurements(params: ClinicalMeasurementListParams = {}) {
  return apiRequest<PaginatedResponse<ClinicalMeasurementApi>>(`clinical-measurements/${queryString(params)}`);
}

export function createClinicalMeasurement(payload: CreateClinicalMeasurementPayload) {
  return apiRequest<ClinicalMeasurementApi>("clinical-measurements/", { method: "POST", body: payload });
}

export function updateClinicalMeasurement(id: number | string, payload: UpdateClinicalMeasurementPayload) {
  return apiRequest<ClinicalMeasurementApi>(`clinical-measurements/${id}/`, { method: "PATCH", body: payload });
}

export function deleteClinicalMeasurement(id: number | string) {
  return apiRequest<void>(`clinical-measurements/${id}/`, { method: "DELETE" });
}

export function listCareSessionMaterials(params: CareSessionMaterialListParams = {}) {
  return apiRequest<PaginatedResponse<CareSessionMaterialApi>>(`care-session-materials/${queryString(params)}`);
}

export function createCareSessionMaterial(payload: CreateCareSessionMaterialPayload) {
  return apiRequest<CareSessionMaterialApi>("care-session-materials/", { method: "POST", body: payload });
}

export function updateCareSessionMaterial(id: number | string, payload: UpdateCareSessionMaterialPayload) {
  return apiRequest<CareSessionMaterialApi>(`care-session-materials/${id}/`, { method: "PATCH", body: payload });
}

export function deleteCareSessionMaterial(id: number | string) {
  return apiRequest<void>(`care-session-materials/${id}/`, { method: "DELETE" });
}

export function listCareParameterDefinitions(params: CareParameterDefinitionListParams = {}) {
  return apiRequest<PaginatedResponse<CareParameterDefinitionApi>>(`care-parameter-definitions/${queryString(params)}`);
}

export function listCareSessionParameters(params: CareSessionParameterListParams = {}) {
  return apiRequest<PaginatedResponse<CareSessionParameterApi>>(`care-session-parameters/${queryString(params)}`);
}

export function createCareSessionParameter(payload: CreateCareSessionParameterPayload) {
  return apiRequest<CareSessionParameterApi>("care-session-parameters/", { method: "POST", body: payload });
}

export function updateCareSessionParameter(id: number | string, payload: UpdateCareSessionParameterPayload) {
  return apiRequest<CareSessionParameterApi>(`care-session-parameters/${id}/`, { method: "PATCH", body: payload });
}

export function deleteCareSessionParameter(id: number | string) {
  return apiRequest<void>(`care-session-parameters/${id}/`, { method: "DELETE" });
}

export const careApiService = {
  listCareCategories,
  listCareTypes,
  listCares,
  getCare,
  createCare,
  updateCare,
  deleteCare,
  listCareSessions,
  getCareSession,
  createCareSession,
  updateCareSession,
  startCareSession,
  completeCareSession,
  listCareObservations,
  createCareObservation,
  updateCareObservation,
  deleteCareObservation,
  listClinicalMeasurements,
  createClinicalMeasurement,
  updateClinicalMeasurement,
  deleteClinicalMeasurement,
  listCareSessionMaterials,
  createCareSessionMaterial,
  updateCareSessionMaterial,
  deleteCareSessionMaterial,
  listCareParameterDefinitions,
  listCareSessionParameters,
  createCareSessionParameter,
  updateCareSessionParameter,
  deleteCareSessionParameter,
};
