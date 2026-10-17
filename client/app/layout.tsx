import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import "./globals.css";
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.ttf",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: "Cabinet médical", template: "%s | Cabinet médical" },
  description: "Cabinet Dr NAIT ABDESSELAM Gaya — Cabinet médical spécialisé en chirurgie plastique et esthétique",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr" className={jakarta.variable}><body><AuthProvider>{children}</AuthProvider></body></html>;
}
