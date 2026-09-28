export interface ClinicalPhoto {
 id: string; patientId: string; date: string; phase: "Avant" | "Après";
 intervention: string; category: string; notes: string;
 image: { src: string; alt: string; width: number; height: number };
}
