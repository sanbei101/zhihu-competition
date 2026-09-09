import { WorldFinaleView } from "@/components/world-finale";

interface FinalePageProps {
  params: Promise<{ id: string }>;
}

export default async function FinalePage({ params }: FinalePageProps) {
  const { id } = await params;

  return (
    <main className="bg-muted/30 text-foreground min-h-screen">
      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
        <WorldFinaleView worldId={id} />
      </section>
    </main>
  );
}
