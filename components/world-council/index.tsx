"use client";

import {
  ArrowLeft,
  CircleDot,
  Clock3,
  GitFork,
  ScrollText,
  TrendingDown,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ThemeScene } from "@/components/pixel/theme-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BranchTimeline } from "@/components/world-council/branch-timeline";
import { DecisionPanel } from "@/components/world-council/decision-panel";
import { SeatsPanel } from "@/components/world-council/seats-panel";
import { SpeechStage } from "@/components/world-council/speech-stage";
import { Timeline } from "@/components/world-council/timeline";
import { useCouncilSession } from "@/components/world-council/use-council-session";
import { WorldTabs } from "@/components/world-council/world-tabs";
import { WorldIntro } from "@/components/world-intro";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  actForRound,
  endingLabels,
  pressureLabels,
  type WorldGameSession,
} from "@/lib/world-ending";

interface WorldCouncilProps {
  initial: WorldGameSession;
  worldId: string;
  onBack: () => void;
  skin: ScenarioSkin;
}

export function WorldCouncil({ initial, worldId, onBack, skin }: WorldCouncilProps) {
  const router = useRouter();
  const session = useCouncilSession({ initial, worldId });

  const {
    cast,
    player,
    round,
    metrics,
    turns,
    ending,
    relations,
    crisis,
    ultimatum,
    ended,
    currentTurnSettled,
    pressure,
    entropy,
    options,
    isGeneratingOptions,
    optionsError,
    choiceDisabled,
    chooseOption,
    retryOptions,
    submittedDecision,
    submittedBranch,
    reactions,
    retorts,
    isResolving,
    isJudging,
    judgeError,
    retryJudge,
    isTurnComplete,
    startNextRound,
    canCloseVoluntarily,
    closeVoluntarily,
    turnError,
    idleOption,
    currentBeat,
    stagePhase,
    stageIdleHint,
    stageSpeakerId,
    stageOpponentId,
    handleBeatDone,
    skipPerformance,
    showIntro,
    setShowIntro,
    agentStatuses,
    lastDeltas,
    lastEntropy,
    lastCrisisPenalty,
    showOpening,
  } = session;

  if (!player) {
    return (
      <Card className="mx-auto max-w-lg shadow-none">
        <CardHeader>
          <CardTitle>玩家角色丢失</CardTitle>
          <p className="text-muted-foreground text-sm leading-6">
            存档中的角色与当前阵容不一致,请返回世界线页面重新建档。
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

  const activePlayer = player;

  function goFinale() {
    router.push(`/world/${encodeURIComponent(worldId)}/finale`);
  }

  return (
    <div className="space-y-4">
      <ThemeScene skin={skin} variant="strip" className="border-border rounded-md border" />
      {showIntro ? (
        <WorldIntro
          crisis={cast.setting.crisis}
          opening={cast.setting.opening}
          onDone={() => setShowIntro(false)}
        />
      ) : null}
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回角色选择">
            <ArrowLeft />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{`回合 ${String(round).padStart(2, "0")}`}</Badge>
              <Badge variant="outline">
                <CircleDot data-icon="inline-start" />
                {actForRound(round)}
              </Badge>
              {pressure !== "stable" ? (
                <Badge variant="destructive">{pressureLabels[pressure]}</Badge>
              ) : null}
              {entropy > 0 ? (
                <Badge variant="outline" className="gap-1">
                  <TrendingDown className="size-3" />
                  大势每回合流失 {entropy}
                </Badge>
              ) : null}
              <Badge variant="secondary">{skin.name}</Badge>
              {ended && ending ? (
                <Badge variant="secondary">{endingLabels[ending.type]}</Badge>
              ) : null}
            </div>
            <h2 className="mt-2 text-xl font-semibold">危机议事</h2>
            <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
              {initial.scenarioTitle}
            </p>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clock3 className="size-4" />
          {cast.setting.time} · {cast.setting.location}
        </div>
      </div>

      <Tabs defaultValue="council" className="gap-4">
        <TabsList className="grid h-10 w-full grid-cols-3 sm:w-fit sm:min-w-96">
          <TabsTrigger value="council">
            <Users data-icon="inline-start" />
            议事现场
          </TabsTrigger>
          <TabsTrigger value="messages">
            <ScrollText data-icon="inline-start" />
            消息记录
          </TabsTrigger>
          <TabsTrigger value="branches">
            <GitFork data-icon="inline-start" />
            世界线
          </TabsTrigger>
        </TabsList>

        <TabsContent value="council" className="mt-0">
          <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
            <div className="order-2 lg:order-1">
              <SeatsPanel
                cast={cast}
                activePlayer={activePlayer}
                agentStatuses={agentStatuses}
                relations={relations}
                ultimatum={ultimatum}
                speakingId={stageSpeakerId}
                opposingId={stageOpponentId}
                skin={skin}
              />
            </div>

            <div className="order-1 min-w-0 space-y-4 lg:order-2">
              <SpeechStage
                skin={skin}
                beat={currentBeat}
                player={activePlayer}
                phase={stagePhase}
                idleHint={stageIdleHint}
                onBeatDone={handleBeatDone}
                onSkip={skipPerformance}
              />

              <Card className="shadow-none">
                <CardContent className="p-0">
                  <DecisionPanel
                    cast={cast}
                    ended={ended}
                    currentTurnSettled={currentTurnSettled}
                    submittedDecision={submittedDecision}
                    submittedBranch={submittedBranch}
                    isGeneratingOptions={isGeneratingOptions}
                    options={options}
                    optionsError={optionsError}
                    onRetryOptions={retryOptions}
                    choiceDisabled={choiceDisabled}
                    onChooseOption={(option) => void chooseOption(option)}
                    isResolving={isResolving}
                    reactions={reactions}
                    isJudging={isJudging}
                    judgeError={judgeError}
                    onRetryJudge={retryJudge}
                    isTurnComplete={isTurnComplete}
                    turnsCount={turns.length}
                    onStartNextRound={startNextRound}
                    canCloseVoluntarily={canCloseVoluntarily}
                    onCloseVoluntarily={closeVoluntarily}
                    onGoFinale={goFinale}
                    turnError={turnError}
                    crisis={crisis}
                    ultimatum={ultimatum}
                    idleOption={idleOption}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="order-3 lg:order-3">
              <WorldTabs
                cast={cast}
                activePlayer={activePlayer}
                metrics={metrics}
                lastDeltas={lastDeltas}
                lastEntropy={lastEntropy}
                lastCrisisPenalty={lastCrisisPenalty}
                round={round}
                turns={turns}
                relations={relations}
                reactions={reactions}
                retorts={retorts}
                submittedDecision={submittedDecision}
                currentTurnSettled={currentTurnSettled}
                isTurnComplete={isTurnComplete}
                crisis={crisis}
                ultimatum={ultimatum}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="mt-0">
          <Card className="shadow-none">
            <CardContent className="p-0">
              <Timeline
                cast={cast}
                activePlayer={activePlayer}
                turns={turns}
                ended={ended}
                ending={ending}
                showOpening={showOpening}
                onGoFinale={goFinale}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches" className="mt-0">
          <BranchTimeline
            round={round}
            turns={turns}
            options={options}
            submittedBranch={submittedBranch}
            ended={ended}
            ending={ending}
            choiceDisabled={choiceDisabled}
            onChooseOption={(option) => void chooseOption(option)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
