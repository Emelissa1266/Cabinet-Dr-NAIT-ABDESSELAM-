import Image from "next/image";
import type { Metadata } from "next";
import { ClinicBrand } from "@/components/shared/clinic-brand";
import { LoginForm } from "@/features/auth/components/login-form";
export const metadata: Metadata = { title: "Connexion" };
export default function LoginPage() {
  return <main className="login-page">
    <section className="login-ambience" aria-label="Le cabinet"><Image src="/images/clinic-reception-v2.png" fill priority sizes="50vw" alt="Réception du cabinet, aux finitions de pierre et de bois clair" className="clinic-photo" /><div className="ambience-overlay" /><div className="ambience-watermark"><span><Image src="/images/dr-nait-logo-mark.jpg" width={34} height={40} alt="" className="ambience-logo-mark" /></span><p>Sanctuaire médical &amp; chirurgical</p></div><div className="ambience-description"><h2>Cabinet Dr NAIT<br />ABDESSELAM Gaya— Espace Médical Privé</h2><p>Plateforme intégrée d’exercice médical et chirurgical haute précision.<br />Confidentialité absolue des dossiers patients et secret médical garantis selon les référentiels HDS &amp; eIDAS.</p><div className="ambience-status"><span>Système interne V1.4</span><span>Chiffrement AES-256</span></div></div></section>
    <section className="login-portal" aria-label="Authentification"><header className="login-brand-header"><ClinicBrand /><span className="context-badge">Gestion médicale &amp; administrative</span></header><div className="login-center"><LoginForm /></div><footer className="login-footer">© 2026 <strong>Cabinet Dr NAIT<br />ABDESSELAM Gaya</strong>. Tous droits réservés. Serveur d’Hébergement de Données de Santé (HDS) certifié.</footer></section>
  </main>;
}
