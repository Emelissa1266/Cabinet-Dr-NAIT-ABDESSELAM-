export type BillingKind = "Consultation" | "Intervention" | "Soins infirmiers" | "Séance";
export interface InvoiceLine { id: string; kind: BillingKind; description: string; quantity: number; unitPrice: number; treatmentId?: string; sessionId?: string }
export interface Invoice {
 id: string; patientId: string; date: string; dueDate: string;
 status: "Émise" | "Brouillon" | "Annulée";
 paymentStatus: "Payée" | "Partielle" | "Non payée";
 lines: InvoiceLine[]; paidAmount: number; notes: string;
 history: { date: string; label: string }[];
}
export const invoiceTotal = (invoice: Invoice) => Math.round(invoice.lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0)*100)/100;
export const invoiceBalance = (invoice: Invoice) => invoice.status==="Annulée"?0:Math.max(0,Math.round((invoiceTotal(invoice)-invoice.paidAmount)*100)/100);
