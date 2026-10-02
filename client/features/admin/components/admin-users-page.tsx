"use client";

import type { AdminUserApi } from "@/features/admin/api-types";
import { AdminConfigPage } from "./admin-config-page";

const roleOptions = [
  { value: "ADMIN", label: "Administrateur" },
  { value: "DOCTOR", label: "Chirurgien" },
  { value: "NURSE", label: "Soins infirmiers" },
  { value: "SECRETARY", label: "Secretariat" },
];

export function AdminUsersPage() {
  return (
    <AdminConfigPage<AdminUserApi>
      eyebrow="Administration"
      title="Utilisateurs"
      description="Creation, roles applicatifs et activation des comptes du personnel."
      path="auth/users"
      ordering="last_name"
      activeField="is_active"
      newLabel="Ajouter un utilisateur"
      searchPlaceholder="Nom, identifiant, email..."
      emptyMessage="Aucun utilisateur configure."
      fields={[
        { name: "username", label: "Nom d'utilisateur", required: true },
        { name: "first_name", label: "Prenom" },
        { name: "last_name", label: "Nom" },
        { name: "email", label: "Email", required: true },
        { name: "phone", label: "Telephone" },
        { name: "role", label: "Role applicatif", type: "select", options: roleOptions, required: true },
        { name: "professional_title", label: "Titre professionnel" },
        { name: "profile_notes", label: "Notes de profil", type: "textarea" },
        { name: "is_active", label: "Compte actif", type: "checkbox" },
        { name: "password", label: "Mot de passe initial", type: "password", required: true, createOnly: true },
      ]}
      columns={[
        { key: "username", label: "Identifiant" },
        { key: "last_name", label: "Nom", render: (item) => `${item.first_name} ${item.last_name}`.trim() || item.username },
        { key: "email", label: "Email" },
        { key: "role", label: "Role" },
      ]}
    />
  );
}
