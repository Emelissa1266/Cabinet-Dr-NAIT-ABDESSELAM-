import {RealBillingWorkspace} from "@/features/billing/components/real-billing-workspace";

export default async function Page({searchParams}:{searchParams:Promise<{new?:string;patient?:string;invoice?:string;appointment?:string}>}) {
  const p=await searchParams;
  return <RealBillingWorkspace key={JSON.stringify(p)} create={p.new==="1"} initialPatientId={p.patient} initialInvoiceId={p.invoice}/>;
}
