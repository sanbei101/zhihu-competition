import { FileText, Handshake, MapPinned, PackageOpen, Radio, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import type { WorldEvent } from "@/lib/world-turn";

const eventLabels: Record<WorldEvent["kind"], string> = {
  decree: "政令",
  dispatch: "军报",
  diplomacy: "外交",
  rumor: "流言",
  shortage: "资源警报",
};

const eventIcons: Record<WorldEvent["kind"], LucideIcon> = {
  decree: FileText,
  dispatch: MapPinned,
  diplomacy: Handshake,
  rumor: Radio,
  shortage: PackageOpen,
};

const severityLabels = {
  low: "低烈度",
  medium: "中烈度",
  high: "高烈度",
} as const;

function EventDetails({ event }: { event: WorldEvent }) {
  if (event.kind === "decree") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs">发布者</p>
          <p className="mt-1 text-sm">{event.issuer}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">执行对象</p>
          <p className="mt-1 text-sm">{event.target}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">代价</p>
          <p className="mt-1 text-sm">{event.cost}</p>
        </div>
        <p className="bg-muted/60 rounded-md p-3 text-sm leading-6 sm:col-span-3">{event.order}</p>
      </div>
    );
  }

  if (event.kind === "dispatch") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs">地点</p>
          <p className="mt-1 text-sm">{event.location}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">兵力</p>
          <p className="mt-1 text-sm">{event.forces}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">伤亡</p>
          <p className="mt-1 text-sm">{event.casualties}</p>
        </div>
        <p className="text-muted-foreground text-sm leading-6 sm:col-span-3">
          推进：{event.movement}
        </p>
      </div>
    );
  }

  if (event.kind === "diplomacy") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs">提出方</p>
          <p className="mt-1 text-sm">{event.from}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">接收方</p>
          <p className="mt-1 text-sm">{event.to}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">关系变化</p>
          <p className="mt-1 text-sm">{event.relation}</p>
        </div>
        <p className="bg-muted/60 rounded-md p-3 text-sm leading-6 sm:col-span-3">
          条件：{event.offer} · 回应：{event.response}
        </p>
      </div>
    );
  }

  if (event.kind === "rumor") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs">传播源</p>
            <p className="mt-1 text-sm">{event.rumorSource}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">传播范围</p>
            <p className="mt-1 text-sm">{event.spread}</p>
          </div>
        </div>
        <p className="bg-muted/60 rounded-md p-3 text-sm leading-6">传闻：{event.claim}</p>
        <Progress value={event.credibility}>
          <ProgressLabel>可信度</ProgressLabel>
          <ProgressValue>{() => `${event.credibility}%`}</ProgressValue>
        </Progress>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-muted-foreground text-xs">短缺资源</p>
        <p className="mt-1 text-sm">{event.resource}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">库存状态</p>
        <p className="mt-1 text-sm">{event.stock}</p>
      </div>
      <p className="bg-muted/60 rounded-md p-3 text-sm leading-6 sm:col-span-2">
        压力：{event.pressure}
      </p>
    </div>
  );
}

export function WorldEventPanel({ event }: { event: WorldEvent }) {
  const Icon = eventIcons[event.kind];

  return (
    <Item variant="outline" className="items-start gap-3 p-4">
      <ItemHeader>
        <div className="flex min-w-0 items-center gap-2">
          <ItemMedia variant="icon" className="text-primary">
            <Icon className="size-4" />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="line-clamp-none">{event.title}</ItemTitle>
            <p className="text-muted-foreground text-xs">{eventLabels[event.kind]}</p>
          </ItemContent>
        </div>
        <Badge variant={event.severity === "high" ? "destructive" : "secondary"}>
          {severityLabels[event.severity]}
        </Badge>
      </ItemHeader>
      <ItemDescription className="line-clamp-none basis-full">{event.summary}</ItemDescription>
      <div className="basis-full">
        <EventDetails event={event} />
      </div>
      <ItemFooter className="text-muted-foreground basis-full justify-start text-xs">
        来源：{event.source} · 相关方：{event.actors.join("、")}
      </ItemFooter>
    </Item>
  );
}
