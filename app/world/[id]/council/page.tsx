import { GitBranch } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { WorldCouncilSession } from "@/components/world-council";

interface CouncilPageProps {
  params: Promise<{ id: string }>;
}

export default async function CouncilPage({ params }: CouncilPageProps) {
  const { id } = await params;

  return (
    <main className="bg-muted/30 text-foreground min-h-screen">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="返回岔路首页">
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
              <GitBranch className="size-4" />
            </span>
            <span className="font-semibold">岔路</span>
          </Link>
          <Badge variant="outline">WORLDLINE / LIVE</Badge>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
        <WorldCouncilSession worldId={id} />
      </section>
    </main>
  );
}
