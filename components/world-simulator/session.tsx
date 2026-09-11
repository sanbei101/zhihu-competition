"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorldSimulator } from "@/components/world-simulator";
import {
  worldSimStorageKey,
  worldSimulationSessionSchema,
  type WorldSimulationSession,
} from "@/lib/world-sim";

export function WorldSimulationSession({ worldId }: { worldId: string }) {
  const [session, setSession] = useState<WorldSimulationSession | null>();
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(worldSimStorageKey(worldId));
      const parsed = raw ? worldSimulationSessionSchema.safeParse(JSON.parse(raw)) : null;
      setSession(parsed?.success && parsed.data.scenarioId === worldId ? parsed.data : null);
    } catch {
      setSession(null);
    }
  }, [worldId]);
  if (session === undefined)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  if (!session)
    return (
      <Card className="mx-auto max-w-lg shadow-none">
        <CardHeader>
          <CardTitle>世界种子尚未建立</CardTitle>
          <p className="text-muted-foreground text-sm leading-6">请先从题目页面建立反事实世界。</p>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href={`/world/${encodeURIComponent(worldId)}`} />}
          >
            <ArrowLeft data-icon="inline-start" />
            返回题目
          </Button>
        </CardContent>
      </Card>
    );
  return <WorldSimulator initial={session} onBack={() => window.history.back()} />;
}
