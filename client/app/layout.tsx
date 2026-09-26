import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import {ClinicProvider} from "@/features/clinic/components/clinic-provider";
import "./globals.css";
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
export const metadata: Metadata = {
  title: { default: "Clinic Management", template: "%s | Clinic Management" },
  description: "Espace professionnel du Cabinet Dr NAIT ABDESSELAM Gaya",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr" className={jakarta.variable}><body><AuthProvider><ClinicProvider>{children}</ClinicProvider></AuthProvider></body></html>;
}
