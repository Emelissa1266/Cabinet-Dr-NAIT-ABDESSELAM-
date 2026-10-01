import type { PaginatedResponse as MedicalPaginatedResponse } from "@/features/medical/types";

export type PaginatedResponse<T> = MedicalPaginatedResponse<T>;

export type BillableCategory = "CONSULTATION" | "SURGERY" | "CARE" | "OTHER";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
export type PaymentStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";

export interface BillableServiceApi {
  id: number;
  code: string;
  name: string;
  description: string;
  category: BillableCategory;
  default_unit_price: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemApi {
  id: number;
  invoice: number;
  billable_service: number | null;
  billable_service_name: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  discount_amount: string;
  gross_amount: string;
  net_amount: string;
  consultation: number | null;
  surgery: number | null;
  care: number | null;
  care_session: number | null;
  appointment: number | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceApi {
  id: number;
  invoice_number: string | null;
  patient: number;
  patient_reference: string;
  patient_name: string;
  status: InvoiceStatus;
  currency: string;
  issue_date: string;
  due_date: string | null;
  discount_amount: string;
  notes: string;
  internal_notes: string;
  created_by: number | null;
  finalized_by: number | null;
  finalized_at: string | null;
  cancelled_by: number | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  subtotal: string;
  discount_total: string;
  total: string;
  paid_amount: string;
  remaining_amount: string;
  is_overdue: boolean;
  items: InvoiceItemApi[];
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocationApi {
  id: number;
  payment: number;
  invoice: number;
  invoice_number: string | null;
  amount: string;
  created_at: string;
}

export interface PaymentApi {
  id: number;
  payment_number: string | null;
  patient: number;
  patient_reference: string;
  patient_name: string;
  amount: string;
  currency: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string;
  reference: string;
  notes: string;
  received_by: number | null;
  cancelled_by: number | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  allocated_amount: string;
  unallocated_amount: string;
  allocations: PaymentAllocationApi[];
  created_at: string;
  updated_at: string;
}

export interface ReceiptApi {
  id: number;
  receipt_number: string | null;
  payment: number;
  payment_number: string | null;
  payment_amount: string;
  payment_method: PaymentMethod;
  patient: number;
  patient_reference: string;
  patient_name: string;
  issued_at: string;
  issued_by: number | null;
  notes: string;
  allocations: Array<{ invoice: number; invoice_number: string | null; amount: string }>;
  created_at: string;
}

export interface PatientFinancialSummaryApi {
  patient: number;
  total_invoiced: string;
  total_paid: string;
  total_remaining: string;
  unpaid_invoices_count: number;
  partially_paid_invoices_count: number;
}

export interface InvoiceListParams {
  page?: number;
  patient?: number | string;
  status?: InvoiceStatus | "";
  search?: string;
  overdue?: boolean | "";
  ordering?: string;
}

export interface PaymentListParams {
  page?: number;
  patient?: number | string;
  status?: PaymentStatus | "";
  payment_method?: PaymentMethod | "";
  search?: string;
  ordering?: string;
}

export interface ReceiptListParams {
  page?: number;
  patient?: number | string;
  payment?: number | string;
  search?: string;
  ordering?: string;
}

export interface BillableServiceListParams {
  page?: number;
  category?: BillableCategory | "";
  is_active?: boolean | "";
  currency?: string;
  search?: string;
  ordering?: string;
}

export interface CreateInvoicePayload {
  patient: number;
  issue_date?: string;
  due_date?: string | null;
  discount_amount?: string;
  notes?: string;
  internal_notes?: string;
}

export type UpdateInvoicePayload = Partial<CreateInvoicePayload>;

export interface CreateInvoiceItemPayload {
  invoice: number;
  billable_service?: number | null;
  description?: string;
  quantity?: string;
  unit_price?: string;
  discount_amount?: string;
  consultation?: number | null;
  surgery?: number | null;
  care?: number | null;
  care_session?: number | null;
  appointment?: number | null;
}

export type UpdateInvoiceItemPayload = Partial<CreateInvoiceItemPayload>;

export interface CreatePaymentPayload {
  patient: number;
  amount: string;
  payment_method: PaymentMethod;
  paid_at?: string;
  reference?: string;
  notes?: string;
}

export type UpdatePaymentPayload = Partial<CreatePaymentPayload>;
