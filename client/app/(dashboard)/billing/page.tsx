import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { BillingWorkspace } from "@/features/billing/components/billing-workspace";
import { billingService } from "@/features/billing/services/billing-service";
import { patientService } from "@/features/patients/services/patient-service";
export const metadata = { title: "Facturation" };
export default async function BillingPage(){const [invoices,patients]=await Promise.all([billingService.listInvoices(),patientService.list()]);return <DoctorOnly><BillingWorkspace invoices={invoices} patients={patients}/></DoctorOnly>;}
