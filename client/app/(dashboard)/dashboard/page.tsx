import type { Metadata } from "next";
import { RealDashboard } from "@/features/dashboard/components/real-dashboard";

export const metadata: Metadata = { title: "Tableau de bord" };
export default function DashboardPage() {
  return <RealDashboard />;
}
