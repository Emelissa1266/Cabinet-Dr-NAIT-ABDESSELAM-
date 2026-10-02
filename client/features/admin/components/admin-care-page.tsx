"use client";

import { useMemo, useState } from "react";
import type { CareCategoryApi, CareParameterDefinitionApi, CareTypeApi } from "@/features/care/api-types";
import { listConfig } from "../services/admin-api-service";
import { AdminGuard } from "./admin-guard";
import { AdminConfigPage, type ConfigField } from "./admin-config-page";

type Tab = "categories" | "types" | "parameters";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "categories", label: "Categories" },
  { id: "types", label: "Types de soins" },
  { id: "parameters", label: "Parametres" },
];

export function AdminCarePage() {
  const [tab, setTab] = useState<Tab>("categories");
  const categoryFields: ConfigField[] = useMemo(() => [
    { name: "name", label: "Nom", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "is_active", label: "Actif", type: "checkbox" },
  ], []);
  const typeFields: ConfigField[] = useMemo(() => [
    { name: "category", label: "Categorie", type: "select", required: true },
    { name: "name", label: "Nom", required: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "default_duration_minutes", label: "Duree par defaut", type: "number" },
    { name: "default_price", label: "Tarif par defaut" },
    { name: "requires_vital_signs", label: "Signes vitaux requis", type: "checkbox" },
    { name: "requires_observation", label: "Observation requise", type: "checkbox" },
    { name: "is_active", label: "Actif", type: "checkbox" },
  ], []);
  const parameterFields: ConfigField[] = useMemo(() => [
    { name: "care_type", label: "Type de soin", type: "select", required: true },
    { name: "key", label: "Cle technique", required: true },
    { name: "label", label: "Libelle", required: true },
    { name: "data_type", label: "Type de donnee", type: "select", options: [
      { value: "TEXT", label: "Texte" },
      { value: "NUMBER", label: "Nombre" },
      { value: "BOOLEAN", label: "Booleen" },
      { value: "DATE", label: "Date" },
    ] },
    { name: "unit", label: "Unite" },
    { name: "required", label: "Obligatoire", type: "checkbox" },
    { name: "active", label: "Actif", type: "checkbox" },
  ], []);

  const categoryOptions = async () => {
    const page = await listConfig<CareCategoryApi>("care-categories", { ordering: "name" });
    return { category: page.results.map((item) => ({ value: item.id, label: item.name })) };
  };
  const careTypeOptions = async () => {
    const page = await listConfig<CareTypeApi>("care-types", { ordering: "name" });
    return { care_type: page.results.map((item) => ({ value: item.id, label: item.name })) };
  };

  return (
    <AdminGuard>
      <nav className="admin-tabs" aria-label="Configuration soins">
        {tabs.map((item) => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>
      {tab === "categories" && (
        <AdminConfigPage<CareCategoryApi>
          eyebrow="Administration soins"
          title="Categories de soins"
          description="Catalogue des familles de soins utilisees par les plans de soins."
          path="care-categories"
          fields={categoryFields}
          activeField="is_active"
          emptyMessage="Aucune categorie de soin configuree."
          columns={[{ key: "name", label: "Nom" }, { key: "description", label: "Description" }]}
        />
      )}
      {tab === "types" && (
        <AdminConfigPage<CareTypeApi>
          eyebrow="Administration soins"
          title="Types de soins"
          description="Types utilises par les prescriptions de soins et l'execution infirmiere."
          path="care-types"
          fields={typeFields}
          activeField="is_active"
          dependencies={categoryOptions}
          emptyMessage="Aucun type de soin configure."
          columns={[{ key: "name", label: "Nom" }, { key: "category", label: "Categorie" }, { key: "default_price", label: "Tarif" }]}
        />
      )}
      {tab === "parameters" && (
        <AdminConfigPage<CareParameterDefinitionApi>
          eyebrow="Administration soins"
          title="Parametres dynamiques"
          description="Definitions qui pilotent les valeurs saisies pendant les seances."
          path="care-parameter-definitions"
          fields={parameterFields}
          activeField="active"
          ordering="key"
          dependencies={careTypeOptions}
          emptyMessage="Aucun parametre de soin configure."
          columns={[{ key: "label", label: "Libelle" }, { key: "key", label: "Cle" }, { key: "data_type", label: "Type" }]}
        />
      )}
    </AdminGuard>
  );
}
