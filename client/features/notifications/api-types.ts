import type { PaginatedResponse as MedicalPaginatedResponse } from "@/features/medical/types";

export type PaginatedResponse<T> = MedicalPaginatedResponse<T>;

export type NotificationType = "APPOINTMENT" | "SURGERY" | "PREOPERATIVE" | "CARE" | "BILLING" | "SYSTEM";
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface NotificationApi {
  id: number;
  recipient: number;
  notification_type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  patient: number | null;
  patient_reference: string | null;
  appointment: number | null;
  surgery: number | null;
  care: number | null;
  care_session: number | null;
  invoice: number | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationListParams {
  page?: number;
  is_read?: boolean | "";
  notification_type?: NotificationType | "";
  priority?: NotificationPriority | "";
  created_at__date?: string;
  created_at__gte?: string;
  created_at__lte?: string;
  ordering?: string;
}

export interface UnreadCountApi {
  unread_count: number;
}

export interface MarkAllReadApi {
  updated: number;
}
