"use client";

import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { errorEnvelopeSchema, userErrorMessage } from "@/lib/app-error";
import { readNdjsonStream } from "@/lib/ndjson-stream";
import type { ScenarioTheme, ScenarioTopic } from "@/lib/scenario-library";
import {
  seedStreamEventSchema,
  type WorldEntity,
  type WorldSeed,
  type WorldState,
  worldSimStorageKey,
  type SeedStreamEvent,
} from "@/lib/world-sim";
import type { WorldSimulationSession } from "@/lib/world-sim";

export function WorldSeedPanel({ theme, topic }: { theme: ScenarioTheme; topic: ScenarioTopic }) {
  const router = useRouter();
  const [seed, setSeed] = useState<WorldSeed | null>(null);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [premise, setPremise] = useState<WorldSeed["premise"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem(worldSimStorageKey(topic.id));
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && "seed" in parsed) {
        const session = parsed as WorldSimulationSession;
        setSeed(session.seed);
        setPremise(session.seed.premise);
        setEntities(session.seed.entities);
      }
    } catch {
      sessionStorage.removeItem(worldSimStorageKey(topic.id));
    }
  }, [topic.id]);

  async function createWorld() {
    setLoading(true);
    setError("");
    setEntities([]);
    setSeed(null);
    try {
      const response = await fetch("/api/world-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: topic.id,
          title: topic.title,
          themeId: theme.id,
          themeName: theme.name,
          themeVisual: theme.visual,
          themeHint: theme.hint,
          url: topic.url,
        }),
      });
      if (!response.ok) {
        let message = `世界种子生成失败(${response.status})`;
        try {
          const body: unknown = await response.json();
          const parsed = errorEnvelopeSchema.safeParse(body);
          if (parsed.success) message = userErrorMessage(parsed.data.error);
        } catch {
          // 使用状态码提示
        }
        throw new Error(message);
      }
      const complete: { seed: WorldSeed; state: WorldState } | null = null;
      const result: { value: { seed: WorldSeed; state: WorldState } | null } = { value: complete };
      await readNdjsonStream(response, seedStreamEventSchema, (event: SeedStreamEvent) => {
        if (event.type === "setting") setPremise(event.premise);
        if (event.type === "entity") setEntities((current) => [...current, event.entity]);
        if (event.type === "complete") result.value = event;
        if (event.type === "error") throw new Error(event.message);
      });
      if (!result.value) throw new Error("世界种子没有完整生成");
      const session: WorldSimulationSession = {
        version: 2,
        scenarioId: topic.id,
        scenarioTitle: topic.title,
        themeId: theme.id,
        seed: result.value.seed,
        currentState: result.value.state,
        activeBranchId: "main",
        snapshots: [],
        focusEntityId: null,
        status: "ongoing",
      };
      sessionStorage.setItem(worldSimStorageKey(topic.id), JSON.stringify(session));
      setSeed(result.value.seed);
      setPremise(result.value.seed.premise);
      setEntities(result.value.seed.entities);
      toast.add({ title: "世界种子已建立", description: "正在打开世界线控制台", type: "success" });
      router.push(`/world/${encodeURIComponent(topic.id)}/council`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "世界种子生成失败";
      setError(message);
      toast.add({ title: "世界建立失败", description: message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="p-6">
        <Badge variant="secondary" className="w-fit">
          WORLDLINE / SEED
        </Badge>
        <CardTitle className="pt-2 text-xl leading-8">建立反事实世界</CardTitle>
        <CardDescription className="leading-6">
          模型会从一个前提出发，生成异质主体、硬规则和初始状态。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6">
        <div className="space-y-3 text-sm">
          <div className="flex gap-3">
            <span className="text-primary font-mono">01</span>
            <span>锁定题目标题中的唯一偏离点</span>
          </div>
          <div className="flex gap-3">
            <span className="text-primary font-mono">02</span>
            <span>生成生态、制度、人口或技术主体</span>
          </div>
          <div className="flex gap-3">
            <span className="text-primary font-mono">03</span>
            <span>建立可被后续行动约束的世界状态</span>
          </div>
        </div>
        {premise ? (
          <div className="bg-muted border-border rounded-md border p-4 text-sm leading-6">
            <p className="text-muted-foreground text-xs">反事实前提</p>
            <p className="mt-1 font-medium">{premise.statement}</p>
          </div>
        ) : null}
        {entities.length ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              主体生成进度 {entities.length}
              {seed ? ` / ${seed.entities.length}` : ""}
            </p>
            {entities.map((entity) => (
              <div key={entity.id} className="flex items-center gap-2 text-sm">
                <span className="bg-primary size-2 rounded-full" />
                <span>{entity.name}</span>
                <span className="text-muted-foreground">{entity.kind}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-destructive min-h-5 text-sm" role="alert">
          {error}
        </p>
      </CardContent>
      <CardFooter className="bg-muted/30 flex-col items-stretch gap-2 border-t px-6 py-4">
        <Button className="w-full" onClick={createWorld} disabled={loading}>
          {loading ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : seed ? (
            <RefreshCw data-icon="inline-start" />
          ) : (
            <Sparkles data-icon="inline-start" />
          )}
          {loading ? `正在建立世界 (${entities.length})` : seed ? "重新建立世界" : "生成世界种子"}
        </Button>
      </CardFooter>
    </Card>
  );
}
