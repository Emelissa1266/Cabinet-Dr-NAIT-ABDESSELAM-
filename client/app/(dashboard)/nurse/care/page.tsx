import { NurseCare } from "@/features/nurse/components/nurse-care";
export default async function Page({ searchParams }: {
    searchParams: Promise<{
        session?: string;
    }>;
}) { const { session } = await searchParams; return <NurseCare initialSession={session}/>; }
