import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { PhotoLibrary } from "@/features/phototheque/components/photo-library";
import { photoService } from "@/features/phototheque/services/photo-service";
import { mockPatients } from "@/features/patients/data/mock-patients";
export const metadata = { title: "Photothèque" };
export default async function PhotothequePage(){const photos=await photoService.list();return <DoctorOnly><PhotoLibrary photos={photos} patients={mockPatients}/></DoctorOnly>;}
