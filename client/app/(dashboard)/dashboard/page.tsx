import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
export const metadata: Metadata = { title: "Tableau de bord" };
export default function DashboardPage() {
  return <><PageHeader title="Votre espace professionnel" eyebrow="Cabinet Dr NAIT ABDESSELAM Gaya" description="Tableau de bord" /><section className="dashboard-placeholder" aria-labelledby="workspace-title"><h2 id="workspace-title">Bienvenue dans votre espace</h2><p>Les modules de gestion du cabinet seront disponibles prochainement.</p></section></>;
}
