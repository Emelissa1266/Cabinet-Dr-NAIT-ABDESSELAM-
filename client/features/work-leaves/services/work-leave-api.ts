import { apiRequest, apiBlobRequest } from "@/lib/api-client";
import { queryString } from "@/features/medical/services/query";
import type { PaginatedResponse } from "@/features/medical/types";
import type { LeavePayload, LeaveStatus, WorkLeave } from "../types";

export interface LeaveQuery {page?: number; patient?: number; consultation?: number; status?: LeaveStatus | ""; search?: string; ordering?: string}
export const listLeaves = (params: LeaveQuery = {}) => apiRequest<PaginatedResponse<WorkLeave>>(`work-leaves/${queryString(params)}`, {cache: "no-store"});
export async function allLeaves(params: LeaveQuery) {
  const results: WorkLeave[] = [];
  let page = 1;
  let response;
  do { response = await listLeaves({...params, page: page++}); results.push(...response.results); } while (response.next);
  return results;
}
export const createLeave = (body: LeavePayload) => apiRequest<WorkLeave>("work-leaves/", {method: "POST", body});
export const updateLeave = (id: number, body: LeavePayload) => apiRequest<WorkLeave>(`work-leaves/${id}/`, {method: "PATCH", body});
export const issueLeave = (id: number) => apiRequest<WorkLeave>(`work-leaves/${id}/issue/`, {method: "POST", body: {}});
export const cancelLeave = (id: number, cancellation_reason: string) => apiRequest<WorkLeave>(`work-leaves/${id}/cancel/`, {method: "POST", body: {cancellation_reason}});
export const deleteLeave = (id: number) => apiRequest<void>(`work-leaves/${id}/`, {method: "DELETE"});
export const leavePdf = (id: number, inline = false) => apiBlobRequest(`work-leaves/${id}/${inline ? "print" : "pdf"}/`, {cache: "no-store"});
