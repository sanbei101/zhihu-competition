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
import {
  endingLabels,
  type TurnReactionRecord,
  type WorldEnding,
  type WorldGameSession,
} from "@/lib/world-ending";

interface TimelineProps {
  cast: WorldCast;
  activePlayer: WorldCast["playerCharacters"][number];
  turns: WorldGameSession["turns"];
  submittedDecision: string;
  reactions: TurnReactionRecord[];
  currentTurnSettled: boolean;
  ended: boolean;
  ending: WorldEnding | null;
  openingAnimate: boolean;
  onGoFinale: () => void;
}

export function Timeline({
  cast,
  activePlayer,
  turns,
  submittedDecision,
  reactions,
  currentTurnSettled,
  ended,
  ending,
  openingAnimate,
  onGoFinale,
}: TimelineProps) {
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
                <MessageScrollerItem>
                  <DirectorNarrationMessage
                    title={`世界线导演 · 第 ${turn.round} 回合裁决`}
                    narration={turn.narration}
                    deltas={turn.deltas}
                    events={turn.events}
                    metricReasons={turn.metricReasons}
                    nextSituation={turn.nextSituation}
                  />
                </MessageScrollerItem>
              </Fragment>
            ))}

            {!currentTurnSettled && submittedDecision ? (
              <MessageScrollerItem scrollAnchor>
                <PlayerDecisionMessage
                  playerName={activePlayer.name}
                  decision={submittedDecision}
                />
              </MessageScrollerItem>
            ) : null}

            {!currentTurnSettled
              ? reactions.map(({ agentId, reaction }) => {
                  const character = cast.agentCharacters.find(
                    (candidate) => candidate.id === agentId,
                  );
                  if (!character) return null;

                  return (
                    <MessageScrollerItem key={`reaction-${agentId}`} scrollAnchor>
                      <ReactionMessage characterName={character.name} reaction={reaction} />
                    </MessageScrollerItem>
                  );
                })
              : null}

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
