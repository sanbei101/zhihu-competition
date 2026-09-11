import { GitFork } from "lucide-react";

import { WorldlineEmblem } from "@/components/pixel/entity-emblem-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorldForkView } from "@/components/world-simulator/world-fork";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { type WorldSimSession } from "@/lib/world-sim";

/**
 * 世界线:当前主线、历史阶段节点、每次自然分叉的原因、未选择的候选未来、
 * 正在追踪的分支。对应 plan.md §8.2 的第三个 Tab,也是 branch-timeline 的迁移目标。
 *
 * 选择分叉不再是本地高亮:它会真的改变 currentBranchId,
 * 并让之后所有主体的推演都带着这个新前提走。所以这里只把点击交给上层。
 */
export function WorldHistory({
  session,
  skin,
  onSelectForkAlternative,
  advancing,
}: {
  session: WorldSimSession;
  skin: ScenarioSkin;
  onSelectForkAlternative: (forkId: string, alternativeId: string) => void;
  advancing: boolean;
}) {
  const fork = session.forks.at(-1) ?? null;

  return (
    <div className="space-y-4">
      {/* 反事实前提 */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>反事实前提</CardTitle>
          <CardDescription>
            整条世界线只在这里被改动过一次,其余全部由主体自己演化而来
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm leading-6">{session.seed.premise.statement}</p>
          <p className="text-muted-foreground text-xs">
            分岔点 · {session.seed.premise.divergencePoint}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {session.seed.premise.affectedDomains.map((domain) => (
              <Badge key={domain} variant="outline">
                {domain}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 历史阶段节点:沿用 branch-timeline 的竖线时间轴 */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>历史阶段</CardTitle>
          <CardDescription>从反事实原点一路推到这里</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="border-border relative border-l-2 pl-5">
              <span className="bg-primary absolute top-1 -left-[5px] size-2 rounded-full" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">反事实原点</span>
                <Badge variant="outline">{session.seed.startTime.label}</Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                {session.seed.premise.statement}
              </p>
            </li>

            {session.snapshots.map((snapshot) => {
              const forkHere = session.forks.find((item) => item.snapshotId === snapshot.id);
              return (
                <li key={snapshot.id} className="border-border relative border-l-2 pl-5">
                  <span className="bg-primary absolute top-1 -left-[5px] size-2 rounded-full" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">纪元 {snapshot.era}</span>
                    <Badge variant="outline">{snapshot.timeAfter.label}</Badge>
                    <Badge variant="secondary">{snapshot.spanLabel}</Badge>
                    {forkHere ? (
                      <Badge variant="destructive">
                        <GitFork data-icon="inline-start" />
                        自然分叉
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs leading-5">{snapshot.conclusion}</p>
                  <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem]">
                    <span>{snapshot.events.length} 个全球事件</span>
                    <span>{snapshot.causalChains.length} 条因果链</span>
                    <span>{snapshot.reports.length} 个主体提交行动</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* 自然分叉与候选未来 */}
      {fork ? (
        <WorldForkView
          fork={fork}
          selectedAlternativeId={fork.selectedAlternativeId}
          advancing={advancing}
          onSelect={(alternativeId) => onSelectForkAlternative(fork.id, alternativeId)}
        />
      ) : (
        <Card className="shadow-none">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            还没有出现自然分叉。重大冲突累积到一定程度时,历史会自己岔开。
          </CardContent>
        </Card>
      )}

      {/* 分支列表 */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>正在追踪的分支</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {session.branches.map((branch) => (
            <div key={branch.id} className="flex items-start gap-2.5 rounded-md border p-3">
              <WorldlineEmblem skin={skin} scale={2} className="mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{branch.label}</span>
                  {branch.active ? <Badge>当前主线</Badge> : null}
                </div>
                <p className="text-muted-foreground mt-1 text-xs leading-5">{branch.summary}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
