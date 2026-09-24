import { DoctorOnly } from "@/features/auth/components/doctor-only";
import { PhotoLibrary } from "@/features/phototheque/components/photo-library";
import { photoService } from "@/features/phototheque/services/photo-service";
import { patientService } from "@/features/patients/services/patient-service";
export const metadata = { title: "Photothèque" };
export default async function PhotothequePage(){const [photos,patients]=await Promise.all([photoService.list(),patientService.list()]);return <DoctorOnly><PhotoLibrary photos={photos} patients={patients}/></DoctorOnly>;}
