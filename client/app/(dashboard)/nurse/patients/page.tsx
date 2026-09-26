import { NursePatients } from "@/features/nurse/components/nurse-patients";
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        q?: string;
    }>;
}) { const { q } = await searchParams; return <NursePatients key={q} initialQuery={q}/>; }
