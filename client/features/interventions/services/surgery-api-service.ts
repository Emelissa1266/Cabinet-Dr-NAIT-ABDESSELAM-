import { apiRequest } from "@/lib/api-client";
import { queryString } from "@/features/medical/services/query";
import type {
  AnesthesiaRecordApi,
  AnesthesiaRecordPayload,
  InterventionTypeApi,
  IntraoperativeEventApi,
  IntraoperativeEventPayload,
  PaginatedResponse,
  PostoperativeAssessmentApi,
  PostoperativeAssessmentPayload,
  PostoperativeFollowUpApi,
  PostoperativeFollowUpPayload,
  PreoperativeAssessmentApi,
  PreoperativeAssessmentPayload,
  PreoperativeChecklistItemApi,
  PreoperativeRequirementApi,
  PreoperativeRequirementPayload,
  SurgeryApi,
  SurgeryChildListParams,
  SurgeryComplicationApi,
  SurgeryComplicationPayload,
  SurgeryConsentApi,
  SurgeryConsentPayload,
  SurgeryListParams,
  SurgeryOperativeRecordApi,
  SurgeryOperativeRecordPayload,
  SurgeryPayload,
  SurgeryPreoperativeChecklistApi,
  SurgeryPreoperativeChecklistPayload,
  SurgeryTeamMemberApi,
  SurgeryTeamMemberPayload,
  UpdateSurgeryPayload,
} from "../api-types";

export function listInterventionTypes(params: Record<string, string | number | boolean | undefined | null> = {}) {
  return apiRequest<PaginatedResponse<InterventionTypeApi>>(`intervention-types/${queryString(params)}`);
}

export function listSurgeries(params: SurgeryListParams = {}) {
  return apiRequest<PaginatedResponse<SurgeryApi>>(`surgeries/${queryString(params)}`);
}

export function getSurgery(id: number | string) {
  return apiRequest<SurgeryApi>(`surgeries/${id}/`);
}

export function createSurgery(payload: SurgeryPayload) {
  return apiRequest<SurgeryApi>("surgeries/", { method: "POST", body: payload });
}

export function updateSurgery(id: number | string, payload: UpdateSurgeryPayload) {
  return apiRequest<SurgeryApi>(`surgeries/${id}/`, { method: "PATCH", body: payload });
}

function surgeryAction(id: number | string, action: string, body?: object) {
  return apiRequest<SurgeryApi>(`surgeries/${id}/${action}/`, { method: "POST", body });
}

export const planSurgery = (id: number | string) => surgeryAction(id, "plan");
export const beginPreopSurgery = (id: number | string) => surgeryAction(id, "begin-preop");
export const markSurgeryReady = (id: number | string) => surgeryAction(id, "mark-ready");
export const startSurgery = (id: number | string) => surgeryAction(id, "start");
export const completeSurgery = (id: number | string) => surgeryAction(id, "complete");
export const cancelSurgery = (id: number | string, reason: string) => surgeryAction(id, "cancel", { reason });

export function listPreoperativeAssessments(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<PreoperativeAssessmentApi>>(`preoperative-assessments/${queryString(params)}`);
}

export function createPreoperativeAssessment(payload: PreoperativeAssessmentPayload) {
  return apiRequest<PreoperativeAssessmentApi>("preoperative-assessments/", { method: "POST", body: payload });
}

export function updatePreoperativeAssessment(id: number | string, payload: Partial<PreoperativeAssessmentPayload>) {
  return apiRequest<PreoperativeAssessmentApi>(`preoperative-assessments/${id}/`, { method: "PATCH", body: payload });
}

export function listPreoperativeChecklistItems(params: Record<string, string | number | boolean | undefined | null> = {}) {
  return apiRequest<PaginatedResponse<PreoperativeChecklistItemApi>>(`preoperative-checklist-items/${queryString(params)}`);
}

export function listPreoperativeChecklists(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<SurgeryPreoperativeChecklistApi>>(`preoperative-checklists/${queryString(params)}`);
}

export function createPreoperativeChecklist(payload: SurgeryPreoperativeChecklistPayload) {
  return apiRequest<SurgeryPreoperativeChecklistApi>("preoperative-checklists/", { method: "POST", body: payload });
}

export function updatePreoperativeChecklist(id: number | string, payload: Partial<SurgeryPreoperativeChecklistPayload>) {
  return apiRequest<SurgeryPreoperativeChecklistApi>(`preoperative-checklists/${id}/`, { method: "PATCH", body: payload });
}

export function listPreoperativeRequirements(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<PreoperativeRequirementApi>>(`preoperative-requirements/${queryString(params)}`);
}

export function createPreoperativeRequirement(payload: PreoperativeRequirementPayload) {
  return apiRequest<PreoperativeRequirementApi>("preoperative-requirements/", { method: "POST", body: payload });
}

export function updatePreoperativeRequirement(id: number | string, payload: Partial<PreoperativeRequirementPayload>) {
  return apiRequest<PreoperativeRequirementApi>(`preoperative-requirements/${id}/`, { method: "PATCH", body: payload });
}

export function listSurgeryConsents(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<SurgeryConsentApi>>(`surgery-consents/${queryString(params)}`);
}

export function createSurgeryConsent(payload: SurgeryConsentPayload) {
  return apiRequest<SurgeryConsentApi>("surgery-consents/", { method: "POST", body: payload });
}

export function updateSurgeryConsent(id: number | string, payload: Partial<SurgeryConsentPayload>) {
  return apiRequest<SurgeryConsentApi>(`surgery-consents/${id}/`, { method: "PATCH", body: payload });
}

export function listAnesthesiaRecords(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<AnesthesiaRecordApi>>(`anesthesia-records/${queryString(params)}`);
}

export function createAnesthesiaRecord(payload: AnesthesiaRecordPayload) {
  return apiRequest<AnesthesiaRecordApi>("anesthesia-records/", { method: "POST", body: payload });
}

export function updateAnesthesiaRecord(id: number | string, payload: Partial<AnesthesiaRecordPayload>) {
  return apiRequest<AnesthesiaRecordApi>(`anesthesia-records/${id}/`, { method: "PATCH", body: payload });
}

export function listOperativeRecords(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<SurgeryOperativeRecordApi>>(`operative-records/${queryString(params)}`);
}

export function createOperativeRecord(payload: SurgeryOperativeRecordPayload) {
  return apiRequest<SurgeryOperativeRecordApi>("operative-records/", { method: "POST", body: payload });
}

export function updateOperativeRecord(id: number | string, payload: Partial<SurgeryOperativeRecordPayload>) {
  return apiRequest<SurgeryOperativeRecordApi>(`operative-records/${id}/`, { method: "PATCH", body: payload });
}

export function listSurgeryTeamMembers(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<SurgeryTeamMemberApi>>(`surgery-team-members/${queryString(params)}`);
}

export function createSurgeryTeamMember(payload: SurgeryTeamMemberPayload) {
  return apiRequest<SurgeryTeamMemberApi>("surgery-team-members/", { method: "POST", body: payload });
}

export function listIntraoperativeEvents(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<IntraoperativeEventApi>>(`intraoperative-events/${queryString(params)}`);
}

export function createIntraoperativeEvent(payload: IntraoperativeEventPayload) {
  return apiRequest<IntraoperativeEventApi>("intraoperative-events/", { method: "POST", body: payload });
}

export function listSurgeryComplications(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<SurgeryComplicationApi>>(`surgery-complications/${queryString(params)}`);
}

export function createSurgeryComplication(payload: SurgeryComplicationPayload) {
  return apiRequest<SurgeryComplicationApi>("surgery-complications/", { method: "POST", body: payload });
}

export function listPostoperativeAssessments(params: SurgeryChildListParams = {}) {
  return apiRequest<PaginatedResponse<PostoperativeAssessmentApi>>(`postoperative-assessments/${queryString(params)}`);
}

export function createPostoperativeAssessment(payload: PostoperativeAssessmentPayload) {
  return apiRequest<PostoperativeAssessmentApi>("postoperative-assessments/", { method: "POST", body: payload });
}

export function listPostoperativeFollowUps(params: SurgeryChildListParams & { patient?: number | string } = {}) {
  return apiRequest<PaginatedResponse<PostoperativeFollowUpApi>>(`postoperative-follow-ups/${queryString(params)}`);
}

export function createPostoperativeFollowUp(payload: PostoperativeFollowUpPayload) {
  return apiRequest<PostoperativeFollowUpApi>("postoperative-follow-ups/", { method: "POST", body: payload });
}
