import { PatientDetail } from "@/features/patients/components/patient-detail";
export default async function Page({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; return <PatientDetail id={id} basePath="/nurse/patients" />; }
