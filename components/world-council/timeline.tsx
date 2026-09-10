"use client";

import { Flag, GitBranch, ScrollText } from "lucide-react";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
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
import {
  DirectorNarrationMessage,
  OpeningLineMessage,
  PlayerDecisionMessage,
  ReactionMessage,
} from "@/components/world-council/messages";
import { type WorldCast } from "@/lib/world-cast";
import { endingLabels, type WorldEnding, type WorldGameSession } from "@/lib/world-ending";

interface TimelineProps {
  cast: WorldCast;
  activePlayer: WorldCast["playerCharacters"][number];
  turns: WorldGameSession["turns"];
  ended: boolean;
  ending: WorldEnding | null;
  openingAnimate: boolean;
  onGoFinale: () => void;
}

/**
 * 舞台下方的历史流:只放已经落幕的内容 —— 开场、已裁决的回合、终局。
 * 本回合正在演的那几条不在这里,它们在舞台上一条一条过;
 * 演完由 commitJudgement 整回合落进 turns,顺序与信息都不会重复。
 */
export function Timeline({
  cast,
  activePlayer,
  turns,
  ended,
  ending,
  openingAnimate,
  onGoFinale,
}: TimelineProps) {
  const nameOf = (agentId: string) =>
    cast.agentCharacters.find((candidate) => candidate.id === agentId)?.name ?? agentId;

  return (
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
                <OpeningLineMessage
                  character={character}
                  footer={index < 2 ? "公开表态" : "旁听发言"}
                  animate={openingAnimate}
                />
              </MessageScrollerItem>
            ))}

            {turns.map((turn) => (
              <Fragment key={`turn-${turn.round}`}>
                <MessageScrollerItem>
                  <PlayerDecisionMessage
                    playerName={activePlayer.name}
                    decision={turn.decision}
                    roundLabel={`第 ${turn.round} 回合`}
                  />
                </MessageScrollerItem>
                {turn.reactions.map(({ agentId, reaction }) => {
                  const character = cast.agentCharacters.find(
                    (candidate) => candidate.id === agentId,
                  );
                  if (!character) return null;
                  return (
                    <MessageScrollerItem key={`turn-${turn.round}-reaction-${agentId}`}>
                      <ReactionMessage
                        characterName={character.name}
                        reaction={reaction}
                        animate={false}
                      />
                    </MessageScrollerItem>
                  );
                })}
                {turn.retorts.map(({ agentId, againstId, reaction }) => {
                  const character = cast.agentCharacters.find(
                    (candidate) => candidate.id === agentId,
                  );
                  if (!character) return null;
                  return (
                    <MessageScrollerItem key={`turn-${turn.round}-retort-${agentId}`}>
                      <ReactionMessage
                        characterName={character.name}
                        reaction={reaction}
                        againstName={nameOf(againstId)}
                        animate={false}
                      />
                    </MessageScrollerItem>
                  );
                })}
                {/* 裁决是这一幕的最后一拍:演出散场后让视图跟到它,别让玩家自己找 */}
                <MessageScrollerItem scrollAnchor>
                  <DirectorNarrationMessage
                    title={`世界线导演 · 第 ${turn.round} 回合裁决`}
                    narration={turn.narration}
                    deltas={turn.deltas}
                    entropy={turn.entropy}
                    crisisPenalty={turn.crisisPenalty}
                    events={turn.events}
                    metricReasons={turn.metricReasons}
                    nextSituation={turn.nextSituation}
                  />
                </MessageScrollerItem>
              </Fragment>
            ))}

            {ended && ending ? (
              <MessageScrollerItem scrollAnchor>
                <Message>
                  <MessageAvatar className="size-8 bg-emerald-100 text-emerald-700">
                    <Flag className="size-4" />
                  </MessageAvatar>
                  <MessageContent>
                    <MessageHeader>世界线终局 · {endingLabels[ending.type]}</MessageHeader>
                    <div className="bg-muted max-w-2xl rounded-lg px-4 py-3 leading-7">
                      <p className="font-medium">{ending.title}</p>
                      <p className="text-muted-foreground mt-1 text-sm leading-6">
                        {ending.reason}
                      </p>
                    </div>
                    <MessageFooter>
                      <Button type="button" size="sm" onClick={onGoFinale}>
                        <ScrollText data-icon="inline-start" />
                        查看终章结算
                      </Button>
                    </MessageFooter>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
