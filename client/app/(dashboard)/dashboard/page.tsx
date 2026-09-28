import type { Metadata } from "next";
import { DoctorDashboard } from "@/features/doctor-dashboard/components/doctor-dashboard";
import { dashboardService } from "@/features/doctor-dashboard/services/dashboard-service";
import { DoctorOnly } from "@/features/auth/components/doctor-only";
export const metadata: Metadata = { title: "Tableau de bord" };
export default async function DashboardPage() {
  const data = await dashboardService.getDashboard();
  return <DoctorOnly><DoctorDashboard data={data} /></DoctorOnly>;
}
