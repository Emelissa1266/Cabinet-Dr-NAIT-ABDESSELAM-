import { RealNurseCare } from "@/features/nurse/components/real-nurse-care";

export default async function Page({ searchParams }: {
    searchParams: Promise<{
        session?: string;
    }>;
}) {
    const { session } = await searchParams;
    return <RealNurseCare initialSession={session}/>;
}
