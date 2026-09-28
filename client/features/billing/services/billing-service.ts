import { mockInvoices } from "../data/mock-invoices";
import type { Invoice } from "../types";
export interface BillingService { listInvoices(): Promise<Invoice[]> }
/** Read-only demo adapter. No payment processing or persistence. */
export const billingService: BillingService = { async listInvoices() { return structuredClone(mockInvoices); } };
