import { PatientDetail } from "@/features/patients/components/patient-detail";
export const metadata = { title: "Dossier patient" };
export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientDetail id={id} />;
}
