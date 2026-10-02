"use client";

import type { DocumentCategoryApi } from "@/features/documents/api-types";
import { AdminConfigPage } from "./admin-config-page";

export function AdminDocumentsPage() {
  return (
    <AdminConfigPage<DocumentCategoryApi>
      eyebrow="Administration documents"
      title="Categories de documents"
      description="Classification des fichiers medicaux, administratifs et consentements."
      path="document-categories"
      activeField="is_active"
      newLabel="Ajouter une categorie"
      emptyMessage="Aucune categorie de document configuree."
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Nom", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "system_type", label: "Type systeme", type: "select", options: [
          { value: "CLINICAL", label: "Clinique" },
          { value: "ADMINISTRATIVE", label: "Administratif" },
          { value: "CONSENT", label: "Consentement" },
          { value: "OTHER", label: "Autre" },
        ] },
        { name: "is_active", label: "Actif", type: "checkbox" },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Nom" },
        { key: "system_type", label: "Type" },
        { key: "description", label: "Description" },
      ]}
    />
  );
}
