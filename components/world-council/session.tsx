"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorldCouncil } from "@/components/world-council/index";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { worldCouncilStorageKey } from "@/lib/world-cast";
import { worldGameSessionSchema, type WorldGameSession } from "@/lib/world-ending";

export function WorldCouncilSession({ worldId, skin }: { worldId: string; skin: ScenarioSkin }) {
  const router = useRouter();
  const [session, setSession] = useState<WorldGameSession | null>();
  const key = worldCouncilStorageKey(worldId);

  useEffect(() => {
    const storedSession = sessionStorage.getItem(key);

    if (!storedSession) {
      setSession(null);
      return;
    }

    try {
      const raw: unknown = JSON.parse(storedSession);
      const parsed = worldGameSessionSchema.safeParse(raw);
      setSession(parsed.success && parsed.data.scenarioId === worldId ? parsed.data : null);
    } catch (error) {
      console.error("对局会话恢复失败", error);
      sessionStorage.removeItem(key);
      setSession(null);
    }
  }, [key, worldId]);

  if (session === undefined) {
    return (
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <Skeleton className="h-80" />
        <Skeleton className="h-160" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const player = session?.cast.playerCharacters.find(
    (character) => character.id === session.playerId,
  );

  if (!session || !player) {
    return (
      <Card className="mx-auto max-w-lg shadow-none">
        <CardHeader>
          <CardTitle>对局尚未建立</CardTitle>
          <p className="text-muted-foreground text-sm leading-6">
            请先返回世界线页面生成阵容并选择角色。
          </p>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href={`/world/${encodeURIComponent(worldId)}`} />}
          >
            返回世界线
            <ArrowLeft data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <WorldCouncil initial={session} worldId={worldId} onBack={() => router.back()} skin={skin} />
  );
}
