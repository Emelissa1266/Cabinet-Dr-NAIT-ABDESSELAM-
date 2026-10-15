import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import "./globals.css";
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
export const metadata: Metadata = {
  title: { default: "Cabinet médical", template: "%s | Cabinet médical" },
  description: "Cabinet Dr NAIT ABDESSELAM Gaya — Cabinet médical spécialisé en chirurgie plastique et esthétique",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr" className={jakarta.variable}><body><AuthProvider>{children}</AuthProvider></body></html>;
}
