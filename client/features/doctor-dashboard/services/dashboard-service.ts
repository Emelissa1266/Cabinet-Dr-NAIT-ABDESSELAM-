import { mockDashboard } from "../data/mock-dashboard";
import type { DoctorDashboardData } from "../types";

export interface DashboardService { getDashboard(): Promise<DoctorDashboardData> }
// Replace this implementation with a Django REST adapter when available.
export const dashboardService: DashboardService = {
  async getDashboard() { return structuredClone(mockDashboard); },
};
