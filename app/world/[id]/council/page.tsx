import { WorldCouncilSession } from "@/components/world-council";

interface CouncilPageProps {
  params: Promise<{ id: string }>;
}

export default async function CouncilPage({ params }: CouncilPageProps) {
  const { id } = await params;

  return (
    <main className="bg-muted/30 text-foreground min-h-screen">
      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
        <WorldCouncilSession worldId={id} />
      </section>
    </main>
  );
}
