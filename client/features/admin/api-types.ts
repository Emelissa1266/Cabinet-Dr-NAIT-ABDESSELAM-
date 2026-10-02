import type { Role } from "@/features/auth/types";
import type { PaginatedResponse } from "@/features/medical/types";

export type { PaginatedResponse };

export interface AdminUserApi {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: Role;
  professional_title: string;
  profile_notes: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserPayload {
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: Role;
  professional_title?: string;
  profile_notes?: string;
  is_active?: boolean;
  password?: string;
}

export interface StaffWorkingHoursApi {
  id: number;
  staff: number;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffTimeOffApi {
  id: number;
  staff: number;
  start_at: string;
  end_at: string;
  reason: "LEAVE" | "SICK" | "TRAINING" | "PERSONAL" | "OTHER";
  notes: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicClosureApi {
  id: number;
  start_at: string;
  end_at: string;
  reason: string;
  notes: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigListParams {
  page?: number;
  search?: string;
  ordering?: string;
  [key: string]: string | number | boolean | undefined | null;
}
