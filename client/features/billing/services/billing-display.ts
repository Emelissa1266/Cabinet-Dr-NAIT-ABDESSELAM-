import { ApiError } from "@/lib/api-client";
import type { InvoiceStatus, PaymentMethod, PaymentStatus } from "../api-types";

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  CANCELLED: "Annulée",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  COMPLETED: "Comptabilisé",
  CANCELLED: "Annulé",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  BANK_TRANSFER: "Virement",
  CHEQUE: "Chèque",
  OTHER: "Autre",
};

export function billingErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 0) return "Connexion au backend impossible.";
    return `${cause.status} — ${cause.message}`;
  }
  return "La requête financière a échoué.";
}

export function money(value: string | null | undefined, currency = "DZD") {
  if (!value) return `0,00 ${currency}`;
  const [major, minor = "00"] = value.split(".");
  return `${major.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${minor.slice(0, 2).padEnd(2, "0")} ${currency}`;
}

export function dateOnly(value: string | null | undefined) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function localDateTimeInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function toIsoFromLocalInput(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return text ? new Date(text).toISOString() : undefined;
}

export function invoiceTone(status: InvoiceStatus) {
  if (status === "PAID") return "success" as const;
  if (status === "PARTIALLY_PAID") return "warning" as const;
  if (status === "CANCELLED") return "neutral" as const;
  return "neutral" as const;
}
