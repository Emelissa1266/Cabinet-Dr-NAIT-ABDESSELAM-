import { NursePatientDetail } from "@/features/nurse/components/nurse-patients";
export default async function Page({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; return <NursePatientDetail id={id}/>; }
