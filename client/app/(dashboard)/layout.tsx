import { ApplicationShell } from "@/components/layout/application-shell";
export const dynamic = "force-dynamic";
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const date = new Intl.DateTimeFormat("fr-DZ", { dateStyle: "full", timeZone: "Africa/Algiers" }).format(new Date());
  return <ApplicationShell date={date}>{children}</ApplicationShell>;
}
