import { GitFork } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { plausibilityLabels, type WorldFork } from "@/lib/world-sim";

const plausibilityTone: Record<
  WorldFork["alternatives"][number]["plausibility"],
  "default" | "outline" | "destructive"
> = {
  high: "default",
  medium: "outline",
  low: "destructive",
};

/**
 * 自然分叉:重大冲突下历史自己长出来的岔路。
 *
 * 选择不是纯视觉操作:选中的那条路会成为新的 currentBranchId,
 * 之后每个主体都会带着这个前提推演。所以选中之后按钮就锁定,
 * 避免同一条历史线上反复横跳。
 */
export function WorldForkView({
  fork,
  selectedAlternativeId,
  onSelect,
  advancing = false,
}: {
  fork: WorldFork;
  selectedAlternativeId: string | null;
  onSelect: (alternativeId: string) => void;
  advancing?: boolean;
}) {
  const decided = selectedAlternativeId !== null;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitFork className="size-4" />
          自然分叉 · {fork.title}
        </CardTitle>
        <CardDescription>
          {fork.cause}
          {decided ? " 这条世界线已经选定,继续推进就会沿着它走。" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fork.alternatives.map((alternative) => {
          const selected = selectedAlternativeId === alternative.id;
          return (
            <div
              key={alternative.id}
              className={`rounded-md border p-3 transition-colors ${
                selected ? "border-primary bg-accent/40" : "border-dashed"
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{alternative.title}</span>
                <Badge variant={plausibilityTone[alternative.plausibility]}>
                  {plausibilityLabels[alternative.plausibility]}
                </Badge>
                {selected ? <Badge>当前世界线</Badge> : null}
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs leading-5">
                {alternative.premise}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium">驱动因素</p>
                  <ul className="mt-1 space-y-0.5">
                    {alternative.drivers.map((driver) => (
                      <li key={driver} className="text-muted-foreground text-xs leading-5">
                        · {driver}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium">预期后果</p>
                  <ul className="mt-1 space-y-0.5">
                    {alternative.expectedEffects.map((effect) => (
                      <li key={effect} className="text-muted-foreground text-xs leading-5">
                        · {effect}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <Button
                size="sm"
                variant={selected ? "default" : "outline"}
                className="mt-3"
                disabled={decided || advancing}
                onClick={() => onSelect(alternative.id)}
              >
                {selected
                  ? "已选定这条世界线"
                  : decided
                    ? "本岔口已决"
                    : advancing
                      ? "推演进行中"
                      : "选择这条世界线并继续推演"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
