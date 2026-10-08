import Image from "next/image";

export function ClinicBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`clinic-brand ${compact ? "clinic-brand--compact" : ""}`}>
      <Image
        src="/images/dr-nait-logo-wordmark.jpg"
        width={903}
        height={960}
        alt="Dr. Nait Abdessellam Gaya - Chirurgie plastique et esthétique"
        className="clinic-logo"
        sizes={compact ? "112px" : "150px"}
      />
    </div>
  );
}
