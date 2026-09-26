import {DoctorOnly} from "@/features/auth/components/doctor-only";
import {SecretaryBilling} from "@/features/secretary/components/secretary-billing";
export const metadata={title:"Facturation médicale"};
export default function BillingPage(){return <DoctorOnly><SecretaryBilling/></DoctorOnly>;}
