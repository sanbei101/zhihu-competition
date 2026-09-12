"use client";

import { witnessArchetypeFor } from "@/components/pixel/witness";
import { WorldDeck, type DeckStage } from "@/components/world-simulator/world-deck";
import { SCENARIO_SKINS } from "@/lib/scenario-skin";
import { dealHand, originCard } from "@/lib/world-cards";
import type { WorldSimSession } from "@/lib/world-sim";

const skin = SCENARIO_SKINS[0]!;

const entity = (id: string, name: string) => ({
  id,
  name,
  kind: "state" as const,
  description: "探针主体",
  goals: ["活下去"],
  capabilities: ["动员"],
  constraints: ["粮草有限"],
  relations: [],
  pixelArchetype: "state",
});

const seed = {
  scenarioId: "probe",
  scenarioTitle: "探针题目",
  scenarioUrl: "https://example.com",
  themeId: skin.id,
  simulationMode: "historical-civilization" as const,
  premise: {
    statement: "赤壁那一夜,曹操没有败退。",
    divergencePoint: "建安十三年冬,乌林",
    affectedDomains: ["统一进程", "士族格局"],
    certainty: "given" as const,
  },
  startTime: { era: 0, label: "建安十三年", elapsed: "起点" },
  timeScale: "year" as const,
  hardRules: [],
  entities: [entity("a", "曹魏"), entity("b", "江东"), entity("c", "荆州")],
  initialEvents: [],
  witness: {
    name: "许昌太仓的记账小吏",
    role: "替朝廷记粮的人",
    openingLine: "账上的数,比战场上的话实在。",
  },
};

const session = {
  version: 7,
  scenarioId: seed.scenarioId,
  scenarioTitle: seed.scenarioTitle,
  scenarioUrl: seed.scenarioUrl,
  seed,
  snapshots: [
    {
      id: "snap-1",
      era: 1,
      branchId: "branch-main",
      timeBefore: seed.startTime,
      timeAfter: { era: 1, label: "建安十五年", elapsed: "两年后" },
      spanLabel: "世界推进了 2 年",
      reports: [],
      events: [
        {
          id: "evt-1-1",
          era: 1,
          title: "乌林之后,北方开始清点户籍",
          scope: "regional",
          severity: "notable",
          actorEntityIds: ["a"],
          summary: "清点户籍意味着征发,也意味着反抗。",
          choices: [
            {
              id: "c1",
              label: "照册征发",
              hint: "粮是有了,怨也攒下了",
              tone: "bold",
            },
            {
              id: "c2",
              label: "缓征一年",
              hint: "民心回了,军期拖了",
              tone: "cautious",
            },
          ],
          narrator: { speaker: seed.witness.name, line: "册子一旦写成,就得按册子活。" },
        },
        {
          id: "evt-1-2",
          era: 1,
          title: "江东的船仍在江上",
          scope: "regional",
          severity: "info",
          actorEntityIds: ["b"],
          summary: "没有大动作,只是不停。",
        },
      ],
      conclusion: "北方在数人,江东在数船。",
    },
  ],
  forks: [],
  branches: [
    {
      id: "branch-main",
      label: "主线",
      parentBranchId: null,
      forkId: null,
      active: true,
      summary: "",
    },
  ],
  state: {
    currentEra: 1,
    currentBranchId: "branch-main",
    entities: seed.entities,
    latestSnapshotId: "snap-1",
  },
  directives: [],
} as unknown as WorldSimSession;

const snapshot = session.snapshots[0]!;
const hand = dealHand({ session, snapshots: [snapshot], fork: null });
const origin = originCard(seed);

function Probe({ stage, pickedId }: { stage: DeckStage; pickedId: string | null }) {
  return (
    <div data-probe={stage}>
      <WorldDeck
        skin={skin}
        archetype={witnessArchetypeFor(skin.id)}
        witnessLine={null}
        hand={stage === "origin" ? [origin] : hand}
        stage={stage}
        pickedIds={pickedId ? [pickedId] : []}
        activeCardId={pickedId}
        flippingId={null}
        resolvedChoiceId={null}
        onPick={() => {}}
        onChoose={() => {}}
        cardAction={{ label: "拉开这条世界线", onClick: () => {} }}
        busy={false}
        played={[]}
        summary={null}
      />
    </div>
  );
}

export default function DeckProbe() {
  return (
    <div className="space-y-10 p-8">
      <Probe stage="origin" pickedId={origin.id} />
      <Probe stage="pick" pickedId={null} />
      <Probe stage="open" pickedId={hand[0]!.id} />
    </div>
  );
}
