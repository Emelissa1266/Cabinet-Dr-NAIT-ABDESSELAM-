import { apiRequest } from "@/lib/api-client";
import { queryString } from "@/features/medical/services/query";
import type {
  MarkAllReadApi,
  NotificationApi,
  NotificationListParams,
  PaginatedResponse,
  UnreadCountApi,
} from "../api-types";

export function listNotifications(params: NotificationListParams = {}) {
  return apiRequest<PaginatedResponse<NotificationApi>>(`notifications/${queryString(params)}`);
}

export function getNotification(id: number | string) {
  return apiRequest<NotificationApi>(`notifications/${id}/`);
}

export function getUnreadNotificationCount() {
  return apiRequest<UnreadCountApi>("notifications/unread-count/");
}

export function markNotificationRead(id: number | string) {
  return apiRequest<NotificationApi>(`notifications/${id}/mark-read/`, { method: "POST" });
}

export function markNotificationUnread(id: number | string) {
  return apiRequest<NotificationApi>(`notifications/${id}/mark-unread/`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return apiRequest<MarkAllReadApi>("notifications/mark-all-read/", { method: "POST" });
}
