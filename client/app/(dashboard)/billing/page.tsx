import {DoctorOnly} from "@/features/auth/components/doctor-only";
import {RealBillingWorkspace} from "@/features/billing/components/real-billing-workspace";
export const metadata={title:"Facturation médicale"};
export default function BillingPage(){return <DoctorOnly><RealBillingWorkspace/></DoctorOnly>;}
