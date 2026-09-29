import { PatientList } from "@/features/patients/components/patient-list";
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        q?: string;
    }>;
}) { const { q } = await searchParams; return <PatientList basePath="/nurse/patients" initialQuery={q ?? ""} />; }
