import { NursePhotos } from "@/features/nurse/components/nurse-photos";
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        patient?: string;
    }>;
}) { const { patient } = await searchParams; return <NursePhotos key={patient} initialPatient={patient}/>; }
