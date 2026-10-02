"use client";

import type { BillableServiceApi } from "@/features/billing/api-types";
import { AdminConfigPage } from "./admin-config-page";

export function AdminBillingPage() {
  return (
    <AdminConfigPage<BillableServiceApi>
      eyebrow="Administration facturation"
      title="Services facturables"
      description="Catalogue des actes et services disponibles pour les lignes de facture."
      path="billable-services"
      activeField="is_active"
      newLabel="Ajouter un service"
      emptyMessage="Aucun service facturable configure."
      fields={[
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Nom", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "category", label: "Categorie", type: "select", options: [
          { value: "CONSULTATION", label: "Consultation" },
          { value: "SURGERY", label: "Intervention" },
          { value: "CARE", label: "Soin" },
          { value: "OTHER", label: "Autre" },
        ] },
        { name: "default_unit_price", label: "Prix unitaire", required: true },
        { name: "currency", label: "Devise", required: true },
        { name: "is_active", label: "Actif", type: "checkbox" },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Nom" },
        { key: "category", label: "Categorie" },
        { key: "default_unit_price", label: "Prix" },
        { key: "currency", label: "Devise" },
      ]}
    />
  );
}
