import { apiBlobRequest, apiRequest } from "@/lib/api-client";
import { queryString } from "@/features/medical/services/query";
import type {
  BillableServiceApi,
  BillableServiceListParams,
  CreateInvoiceItemPayload,
  CreateInvoicePayload,
  CreatePaymentPayload,
  InvoiceApi,
  InvoiceItemApi,
  InvoiceListParams,
  PaginatedResponse,
  PatientFinancialSummaryApi,
  PaymentAllocationApi,
  PaymentApi,
  PaymentListParams,
  ReceiptApi,
  ReceiptListParams,
  UpdateInvoiceItemPayload,
  UpdateInvoicePayload,
  UpdatePaymentPayload,
} from "../api-types";

export function listBillableServices(params: BillableServiceListParams = {}) {
  return apiRequest<PaginatedResponse<BillableServiceApi>>(`billable-services/${queryString(params)}`);
}

export function listInvoices(params: InvoiceListParams = {}) {
  return apiRequest<PaginatedResponse<InvoiceApi>>(`invoices/${queryString(params)}`);
}

export function getInvoice(id: number | string) {
  return apiRequest<InvoiceApi>(`invoices/${id}/`);
}

export function createInvoice(payload: CreateInvoicePayload) {
  return apiRequest<InvoiceApi>("invoices/", { method: "POST", body: payload });
}

export function updateInvoice(id: number | string, payload: UpdateInvoicePayload) {
  return apiRequest<InvoiceApi>(`invoices/${id}/`, { method: "PATCH", body: payload });
}

export function issueInvoice(id: number | string) {
  return apiRequest<InvoiceApi>(`invoices/${id}/issue/`, { method: "POST" });
}

export function cancelInvoice(id: number | string, reason: string) {
  return apiRequest<InvoiceApi>(`invoices/${id}/cancel/`, { method: "POST", body: { reason } });
}

export function getInvoicePdf(id: number | string) {
  return apiBlobRequest(`invoices/${id}/pdf/`);
}

export function getInvoicePrintPdf(id: number | string) {
  return apiBlobRequest(`invoices/${id}/print/`);
}

export function filenameFromDisposition(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

export function createInvoiceItem(payload: CreateInvoiceItemPayload) {
  return apiRequest<InvoiceItemApi>("invoice-items/", { method: "POST", body: payload });
}

export function updateInvoiceItem(id: number | string, payload: UpdateInvoiceItemPayload) {
  return apiRequest<InvoiceItemApi>(`invoice-items/${id}/`, { method: "PATCH", body: payload });
}

export function deleteInvoiceItem(id: number | string) {
  return apiRequest<void>(`invoice-items/${id}/`, { method: "DELETE" });
}

export function listPayments(params: PaymentListParams = {}) {
  return apiRequest<PaginatedResponse<PaymentApi>>(`payments/${queryString(params)}`);
}

export function getPayment(id: number | string) {
  return apiRequest<PaymentApi>(`payments/${id}/`);
}

export function createPayment(payload: CreatePaymentPayload) {
  return apiRequest<PaymentApi>("payments/", { method: "POST", body: payload });
}

export function updatePayment(id: number | string, payload: UpdatePaymentPayload) {
  return apiRequest<PaymentApi>(`payments/${id}/`, { method: "PATCH", body: payload });
}

export function allocatePayment(paymentId: number | string, invoice: number | string, amount: string) {
  return apiRequest<PaymentAllocationApi>(`payments/${paymentId}/allocate/`, { method: "POST", body: { invoice, amount } });
}

export function completePayment(id: number | string) {
  return apiRequest<PaymentApi>(`payments/${id}/complete/`, { method: "POST" });
}

export function cancelPayment(id: number | string, reason: string) {
  return apiRequest<PaymentApi>(`payments/${id}/cancel/`, { method: "POST", body: { reason } });
}

export function listPaymentAllocations(params: { payment?: number | string; invoice?: number | string } = {}) {
  return apiRequest<PaginatedResponse<PaymentAllocationApi>>(`payment-allocations/${queryString(params)}`);
}

export function listReceipts(params: ReceiptListParams = {}) {
  return apiRequest<PaginatedResponse<ReceiptApi>>(`receipts/${queryString(params)}`);
}

export function getReceipt(id: number | string) {
  return apiRequest<ReceiptApi>(`receipts/${id}/`);
}

export function getPatientFinancialSummary(patientId: number | string) {
  return apiRequest<PatientFinancialSummaryApi>(`patients/${patientId}/financial-summary/`);
}
