"use client";

import { useState } from "react";
import type { InterventionTypeApi, PreoperativeChecklistItemApi } from "@/features/interventions/api-types";
import { AdminGuard } from "./admin-guard";
import { AdminConfigPage } from "./admin-config-page";

type Tab = "types" | "checklist";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "types", label: "Types d'intervention" },
  { id: "checklist", label: "Checklist preoperatoire" },
];

export function AdminSurgeryPage() {
  const [tab, setTab] = useState<Tab>("types");

  return (
    <AdminGuard>
      <nav className="admin-tabs" aria-label="Configuration interventions">
        {tabs.map((item) => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>
      {tab === "types" && (
        <AdminConfigPage<InterventionTypeApi>
          eyebrow="Administration interventions"
          title="Types d'intervention"
          description="Catalogue des interventions selectionnables lors de la creation chirurgicale."
          path="intervention-types"
          activeField="is_active"
          newLabel="Ajouter un type"
          emptyMessage="Aucun type d'intervention configure."
          fields={[
            { name: "name", label: "Nom", required: true },
            { name: "code", label: "Code", required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "is_active", label: "Actif", type: "checkbox" },
          ]}
          columns={[
            { key: "name", label: "Nom" },
            { key: "code", label: "Code" },
            { key: "description", label: "Description" },
          ]}
        />
      )}
      {tab === "checklist" && (
        <AdminConfigPage<PreoperativeChecklistItemApi>
          eyebrow="Administration interventions"
          title="Checklist preoperatoire"
          description="Elements de configuration utilises par la preparation preoperatoire."
          path="preoperative-checklist-items"
          ordering="sort_order"
          activeField="is_active"
          newLabel="Ajouter un element"
          emptyMessage="Aucun element de checklist preoperatoire configure."
          fields={[
            { name: "name", label: "Nom", required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "category", label: "Categorie" },
            { name: "is_required", label: "Obligatoire", type: "checkbox" },
            { name: "is_active", label: "Actif", type: "checkbox" },
            { name: "sort_order", label: "Ordre", type: "number" },
          ]}
          columns={[
            { key: "name", label: "Nom" },
            { key: "category", label: "Categorie" },
            { key: "is_required", label: "Obligatoire", render: (item) => item.is_required ? "Oui" : "Non" },
            { key: "sort_order", label: "Ordre" },
          ]}
        />
      )}
    </AdminGuard>
  );
}
