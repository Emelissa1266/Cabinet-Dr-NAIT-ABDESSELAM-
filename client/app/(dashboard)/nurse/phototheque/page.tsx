import { PhotoLibrary } from "@/features/phototheque/components/photo-library";

export default async function Page({ searchParams }: {
    searchParams: Promise<{
        patient?: string;
    }>;
}) {
  const { patient } = await searchParams;
  return <PhotoLibrary key={patient} initialPatientId={patient} />;
}
