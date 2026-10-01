import { apiRequest } from "@/lib/api-client";
import type { DashboardApi } from "../api-types";

export function getDashboard() {
  return apiRequest<DashboardApi>("dashboard/");
}
