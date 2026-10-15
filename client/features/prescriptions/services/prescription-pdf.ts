import { openPrivatePdf } from "@/lib/private-pdf";
import { filenameFromDisposition } from "@/features/billing/services/billing-api-service";
import { getPrescriptionPdf, getPrescriptionPrintPdf } from "./prescription-service";

export async function downloadPrescriptionPdf(id: number) {
  const response = await getPrescriptionPdf(id);
  const url = URL.createObjectURL(response.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(response.headers.get("content-disposition"), "Ordonnance.pdf");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function previewPrescriptionPdf(id: number, print = false) {
  return openPrivatePdf(() => getPrescriptionPrintPdf(id), print);
}
