"use client";

import {
  Activity,
  ArrowLeft,
  Check,
  CircleDot,
  Clock3,
  GitBranch,
  LoaderCircle,
  LockKeyhole,
  Megaphone,
  SendHorizontal,
  Shield,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorldCast } from "@/lib/world-cast";

interface WorldCouncilProps {
  cast: WorldCast;
  player: WorldCast["playerCharacters"][number];
  onBack: () => void;
}

const worldMetrics = [
  { label: "政权稳定", value: 62, delta: "-3" },
  { label: "军心士气", value: 74, delta: "+6" },
  { label: "民众支持", value: 48, delta: "-8" },
  { label: "战略资源", value: 57, delta: "+2" },
];

const decisionModes = {
  public: {
    label: "公开表态",
    placeholder: "向所有在场角色宣布你的决定……",
  },
  secret: {
    label: "秘密联络",
    placeholder: "写下联络对象与只有对方能看见的内容……",
  },
  mobilize: {
    label: "调动资源",
    placeholder: "说明要调动的权力、人员或物资……",
  },
} as const;

type DecisionMode = keyof typeof decisionModes;

export function WorldCouncil({ cast, player, onBack }: WorldCouncilProps) {
  const [decisionMode, setDecisionMode] = useState<DecisionMode>("public");
  const [decision, setDecision] = useState("");
  const [submittedDecision, setSubmittedDecision] = useState("");

  function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = decision.trim();
    if (!content) return;

    setSubmittedDecision(content);
    setDecision("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回角色选择">
            <ArrowLeft />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>回合 01</Badge>
              <Badge variant="outline">
                <CircleDot data-icon="inline-start" />
                第一幕
              </Badge>
            </div>
            <h2 className="mt-2 text-xl font-semibold">危机议事</h2>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clock3 className="size-4" />
          {cast.setting.time} · {cast.setting.location}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <Card className="order-2 shadow-none lg:order-1">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" />
              议事席位
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Item variant="muted">
              <ItemMedia>
                <Avatar>
                  <AvatarFallback>{player.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle>{player.name}</ItemTitle>
                <p className="text-muted-foreground truncate text-xs">{player.identity}</p>
              </ItemContent>
              <ItemActions>
                <Badge variant="outline" className="px-1.5">
                  由你扮演
                </Badge>
              </ItemActions>
            </Item>

            <Separator />

            <ItemGroup className="gap-1">
              {cast.agentCharacters.map((character, index) => (
                <Item key={character.id} size="xs">
                  <ItemMedia>
                    <Avatar size="sm">
                      <AvatarFallback>{character.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle>{character.name}</ItemTitle>
                    <p className="text-muted-foreground truncate text-xs">{character.faction}</p>
                  </ItemContent>
                  <ItemActions>
                    <span
                      className={
                        index < 2
                          ? "size-2 rounded-full bg-emerald-500"
                          : "size-2 rounded-full bg-amber-500"
                      }
                      aria-label={index < 2 ? "已表态" : "观察中"}
                    />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>

        <Card className="order-1 min-w-0 shadow-none lg:order-2">
          <CardHeader className="border-b">
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 p-3">
              <Megaphone />
              <AlertTitle>突发事件</AlertTitle>
              <AlertDescription className="leading-6">{cast.setting.crisis}</AlertDescription>
            </Alert>
          </CardHeader>

          <CardContent className="p-0">
            <MessageScrollerProvider>
              <MessageScroller className="h-128">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="p-5 sm:p-6">
                    <MessageScrollerItem>
                      <Message>
                        <MessageAvatar className="bg-primary text-primary-foreground size-8">
                          <GitBranch className="size-4" />
                        </MessageAvatar>
                        <MessageContent>
                          <MessageHeader>世界线导演</MessageHeader>
                          <div className="bg-muted max-w-2xl rounded-lg px-4 py-3 leading-7">
                            {cast.setting.opening}
                          </div>
                          <MessageFooter>事件公布</MessageFooter>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>

                    {cast.agentCharacters.map((character, index) => (
                      <MessageScrollerItem key={character.id}>
                        <Message>
                          <MessageAvatar className="size-8">
                            {character.name.slice(0, 1)}
                          </MessageAvatar>
                          <MessageContent>
                            <MessageHeader className="gap-2">
                              <span>{character.name}</span>
                              <span className="font-normal">{character.identity}</span>
                            </MessageHeader>
                            <div className="border-border bg-background max-w-2xl rounded-lg border px-4 py-3 leading-7">
                              {character.openingLine}
                            </div>
                            <MessageFooter>{index < 2 ? "公开表态" : "旁听发言"}</MessageFooter>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}

                    {submittedDecision ? (
                      <MessageScrollerItem scrollAnchor>
                        <Message align="end">
                          <MessageAvatar className="bg-primary text-primary-foreground size-8">
                            {player.name.slice(0, 1)}
                          </MessageAvatar>
                          <MessageContent>
                            <MessageHeader>{player.name} · 你的决策</MessageHeader>
                            <div className="bg-primary text-primary-foreground max-w-2xl rounded-lg px-4 py-3 leading-7">
                              {submittedDecision}
                            </div>
                            <MessageFooter>{decisionModes[decisionMode].label}</MessageFooter>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>

            <form onSubmit={submitDecision} className="border-t p-4 sm:p-5">
              <Tabs
                value={decisionMode}
                onValueChange={(value) => {
                  if (value === "public" || value === "secret" || value === "mobilize") {
                    setDecisionMode(value);
                  }
                }}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="public">
                    <Megaphone data-icon="inline-start" />
                    公开表态
                  </TabsTrigger>
                  <TabsTrigger value="secret">
                    <LockKeyhole data-icon="inline-start" />
                    秘密联络
                  </TabsTrigger>
                  <TabsTrigger value="mobilize">
                    <Shield data-icon="inline-start" />
                    调动资源
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <InputGroup className="mt-3">
                <InputGroupTextarea
                  value={decision}
                  onChange={(event) => setDecision(event.target.value)}
                  placeholder={decisionModes[decisionMode].placeholder}
                  rows={3}
                  maxLength={600}
                />
                <InputGroupAddon align="block-end" className="border-t">
                  <InputGroupText className="text-xs tabular-nums">
                    {decision.length} / 600
                  </InputGroupText>
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="sm"
                    className="ml-auto"
                    disabled={!decision.trim()}
                  >
                    提交决策
                    <SendHorizontal />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {submittedDecision ? (
                <div
                  className="text-muted-foreground mt-3 flex items-center gap-2 text-xs"
                  aria-live="polite"
                >
                  <LoaderCircle className="size-3.5 animate-spin" />
                  决策已锁定，各方正在评估局势
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card className="order-3 shadow-none">
          <Tabs defaultValue="world">
            <CardHeader className="border-b">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="world">
                  <Activity data-icon="inline-start" />
                  世界状态
                </TabsTrigger>
                <TabsTrigger value="round">
                  <GitBranch data-icon="inline-start" />
                  回合进程
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="world" className="space-y-6">
                {worldMetrics.map((metric) => (
                  <Progress key={metric.label} value={metric.value}>
                    <ProgressLabel>{metric.label}</ProgressLabel>
                    <ProgressValue>
                      {() => (
                        <>
                          {metric.value}
                          <span
                            className={
                              metric.delta.startsWith("+")
                                ? "ml-1 text-emerald-600"
                                : "text-destructive ml-1"
                            }
                          >
                            {metric.delta}
                          </span>
                        </>
                      )}
                    </ProgressValue>
                  </Progress>
                ))}
                <Separator />
                <div>
                  <p className="text-muted-foreground text-xs">当前身份</p>
                  <p className="mt-1 font-medium">{player.identity}</p>
                  <p className="text-muted-foreground mt-2 text-xs leading-5">
                    {player.decisionPower}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="round">
                <ol className="space-y-5 text-sm">
                  <li className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check className="size-3.5" />
                    </span>
                    <div>
                      <p className="font-medium">事件公布</p>
                      <p className="text-muted-foreground mt-1 text-xs">危机进入所有角色视野</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs">
                      2
                    </span>
                    <div>
                      <p className="font-medium">玩家决策</p>
                      <p className="text-muted-foreground mt-1 text-xs">选择公开、秘密或资源行动</p>
                    </div>
                  </li>
                  {["Agent 行动", "冲突裁决", "世界更新"].map((step, index) => (
                    <li key={step} className="text-muted-foreground flex gap-3">
                      <span className="bg-muted grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs">
                        {index + 3}
                      </span>
                      <p className="pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
