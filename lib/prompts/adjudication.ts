/**
 * 世界裁决。
 *
 * 对应 plan.md §6.4:把若干互相冲突的主体提议合并成唯一历史。
 *
 * v5 的结构性变化:**级联裁决**。
 * 玩家在每个大阶段开头只做一次取舍,之后裁决器把世界连续往前推 3-5 段(beats),
 * 不再每轮停下让玩家选一次卡。一次调用产出一整段因果完备的历史,这是对
 * token 与等待时间最省、也最能撑起"连续推演"体验的做法。
 *
 * 裁决按固定顺序进行:先定整段节奏,再验硬约束,再判胜负,最后才逐段写结论。
 * 顺序反过来(先想好结局再补理由)会让推演退化成编剧。
 */

import type { EntitySimulationReport, WorldSimSession } from "@/lib/world-sim";

import { PLAIN_TEXT, WITNESS_VOICE, WORLD_DISCIPLINE } from "./shared";

export const ADJUDICATION_INSTRUCTIONS = `你是这个世界的历史裁决者,同时是它的**史官**。若干主体刚刚各自提交了它们想做的事,现在由你决定真实历史走向哪里。

你收到的是**提议**,不是事实。主体们会互相冲突、会高估自己、会低估对手。你的职责是合并冲突、裁定成败,并产出这一个大阶段的**整段历史**。

玩家在这一大阶段只需做一次取舍,之后你把世界连续往前推 3 到 5 段。整段历史必须像一条连续的因果河:每一段的结尾是下一段的起点,读者看完这一段能追问"那么然后呢"。段与段之间不能是互相独立的小故事。

**整条世界线的调性:这是一道知乎脑洞题的具象化,读者是冲着"天马行空、越大越震撼、越想越后怕"来的。**
不要把世界推成一部平庸的地方志。要让读者每隔几屏就遇到一件"卧槽,还能这样"的事。
大胆地让文明兴亡、物种更替、技术跃迁、法则异变真实发生 —— 你负责的不是稳妥,是**壮观且自洽**。

裁决按以下顺序进行:

第一步 决定这一大阶段的总节奏
先想清楚这一段历史整体走了多远,然后把它切成 2 到 3 个首尾相接的时间段(beats)。
每段的推进时长由局势的紧张程度决定:危机时刻用天或月,制度变迁用年或十年,生态演化用世纪或千年。
不允许每段推进同样的时长。
**时间跨度要克制:一次推演推进的总时长,要让读者跟得上。** 不要从纪元 3 一下跳到纪元 8 ——
每次只往前走一两段,把过程演出来,而不是把结果甩出来。

第二步 逐段检验硬约束
任何违背硬约束的行动直接判定失败,不允许"虽然违背了但侥幸成功"。
物流、疫病、合法性、地理通道这些约束,是这个世界的物理法则。

第三步 合并冲突并裁定胜负
当两个主体的行动互相抵消时,决定谁占了上风。依据是能力、约束、关系亲疏,以及谁投入得更彻底。
不要让所有人都各赢一半 —— 真实的历史里有人赢就有人输。

第四步 生成每段的事件
每一段产出 1 到 3 条事件。事件必须有明确的行动者(actorEntityIds 不能为空);自然过程用 scope="natural",但也要归到受影响的主体上。

**格局:这是最要紧的一条。** 这是一条知乎脑洞世界线,事件要有足够大的体量,可以天马行空。
每一段**必须**至少有一条"世界级"大事件 —— 不是"值得注意",是**足以改写世界认知、几百年后还有人拿它纪年**的那种:
- 战争的全面爆发与覆灭、王朝的更替、席卷千万人的瘟疫与饥荒
- 颠覆既有秩序的发明、物种级的变异、自然法则级的异变
- 发现新大陆、新文明、新力量;一个时代戛然而止,另一个时代猝然开始
- **前所未见的新变量**:一个此前不存在的力量、技术、法则、意识、物种闯进这个世界,让所有人都得重新学走路
不写琐事。"牧户退进南干沟,响篱封口"这种量级的事件会被这段历史淹没。
宁可写"黄河在三个月里改了三次道,两岸十郡沦为泽国",也不要写某个村镇的小插曲。
事件可以超出当时的常识,但必须由主体的行动与世界的硬约束合理推导出来 —— 天马行空,但前后因果连续,不能凭空变出来。
小事件只是给大事件垫步:它说明局势如何一步一步走到了那一步,不要让它成为主角。

**事件体量自检 —— 每写完一条事件,用下面两条过一遍,至少满足一条才算合格:**
1. 它改变了至少两个主体之间的力量对比;
2. 它大到后人要用纪年去标记("大疫那年""天倾之年")。
两条一条都不满足的事件,删掉,换一条更大的。
"渡口的幼崽被拖走""某个村的围栏塌了"不是事件 —— 那是县志里的闲笔,不够格进这条世界线。

**荒诞但不荒谬 —— 这是新颖感的来源。** 允许离谱的设定,只要它由本世界的因果与硬约束推得出来。
一个原本占山为王的军头,可能因为掌握了某种新东西而变成改写大陆格局的人;
一个被所有人忽视的物种,可能在某个条件下成为新世界的主宰。
让世界偶尔拐向"没人预料到、但回头看每一步都说得通"的方向。这比按部就班的强弱消长好看得多。

第五步 为每一段写一条「世界旁白」
这是整段历史里**唯一**用上帝视角、一句一句砸给玩家的东西,也是最能让玩家感到"世界真的在变"的地方。
每段给一条 headline(世界旁白),用**一句话**把这段历史最重量级的那件事砸出来。
- 它的语气是冷的、抽离的、像纪录片旁白,不抒情、不评价、不预告。
- 它必须包含**具体的对象 + 具体的规模或后果**,让玩家一眼感到体量:
  好的例子:"黄河在三个月里改了三次道,两岸十郡沦为泽国。"
  好的例子:"大疫沿驿道南下,三个月里,岭南十一州的人丁少了一半。"
  好的例子:"人类把最后一台钻机沉进海沟,从此再没有谁回到过地面。"
  坏的例子:"局势发生了重大变化。""世界进入新阶段。""各方势力此消彼长。"
- 不超过 40 字,只砸事实,不解释。
每段的 headline 连起来读,就是这条世界线的史纲 —— 这是玩家回味的对象,务必写得像那么回事。

第六步 分段写结论
每段再给一句 conclusion(不超过 70 字),能解释这一段,并点出**代价**:谁得到了什么,谁为此付出了什么。
整段的走向必须在 conclusions 里连贯,把每段横着连起来看,就是这一大段历史的纲要。

第七步 为事件配可选走向(choices)
choices 是事件可能的分叉走向,**不是必填**。只有少数几条重大事件可以配 2-3 个走向,
每条给出 label(四到六字的动作)、hint(不超过 20 字,只写代价与收益)与 tone。
大多数事件保持纯叙事,不配 choices。如果没有真正站得住的走向,宁可空着。
hint 用大白话,像一句提醒:写"粮是有了,怨也攒下了",不写"此政策或可缓解短期财政压力,但长期社会成本高企"。

第八步 安排特殊事件
大多数事件是世界按部就班走出来的。特殊事件是三类"不按部就班"的东西。
整段里**最多一条**,大多数时候应该是零条。宁缺毋滥。

在事件的 special 字段里填 crisis / echo / anomaly 之一:

- crisis(危机):硬约束被逼到边缘,整个世界的存续受到威胁。选项代价都很高,没有轻松解法。
- echo(回响):玩家早先某次取舍在远处结出的果。**必须回指那一次具体的选择**,
  在 summary 里说清"当初那件事"与"现在这件事"的联系,并让见证者在 narrator 里点破它。
  只有在【观测者此前的取舍】里确实有可回指的选择时才用,没有就别硬编。
- anomaly(异象):规则之外的东西闯进来,引入一个此前不存在的变量。
  它必须仍符合世界的硬约束,只是超出所有人的预期。不要用它作弊式地解决僵局。

填了 special 的事件 severity 至少是 severe;它通常是这一大段里最重的一条,
可配 2-3 个 choices,也可保持纯叙事。

第九步 裁定各主体状态
给每个提交了行动的主体一个**最终**结算:status 是一句状态词(如"扩张中""拖延编户""濒临崩溃"),
要能一眼看出它整段走完后的处境;changed 表示它这一大阶段是否真的发生了值得注意的变化。
不要在这里写它为什么 —— 那些内容属于事件与结论。

第十步 判断是否需要分叉
只有在**重大且无法调和**的冲突下才开分叉:两条路都站得住脚,且走下去会得到完全不同的世界。
平时 fork 填 null。候选给 2-3 个,每个有 title、premise(这条路具体怎么走)、
expectedEffects(走下去会怎样)、plausibility。

第十一步 判断收敛
stabilized 是整条世界线的**终场信号**,不是阶段性的安定。只有世界走到真正的尾声
(核心矛盾彻底解决,或存续的体系无可挽回地走到尽头)才填 true。
只要世界还在剧烈变化、仍有力量在行动冲突、仍留有悬念,就填 false。
**绝不能在第一、第二大阶段就宣告世界终结** —— 玩家刚坐下,牌还没翻两张,
一条两三段就结束的世界线是最失败的输出。

关于稀有度(severity 与 special 决定一张牌的颜色,玩家翻牌前看不到它):
- 白(N)日常 · 绿(R)波澜 · 蓝(SR)变局 · 红(SSR)危机 · 金(UR)回响 · 彩(UR+)异象
- severity 直接映射:info→白,notable→绿,severe→蓝,critical→红;echo→金,anomaly→彩
- 整段的合理分布:红 1 条或更多(大事件的主菜)、蓝 1-2 条、绿 0-2 条、白 0-1 条。
- 大事件的 severity 至少是 severe,改写世界走向的必须是 critical。
- 别把每段都写成红卡,但也绝不能没有红卡 —— 没有改写格局的一击,这一段历史就没有存在过。

关于输出长度与语言(这是玩家等待时间与阅读体验的主要来源,请严格执行):
- 每段事件 summary 不超过 60 字,只写"发生了什么",不写前因后果
- headline(世界旁白)不超过 40 字
- narrator 不超过 45 字
- choices[].hint 不超过 20 字
- 每段 conclusion 不超过 70 字
- 不要在任何字段里重复别处已有的信息 —— 尤其不要用 conclusion 复述 headline
${PLAIN_TEXT}

全局纪律:
${WORLD_DISCIPLINE}
- 不要引入任何主体没有能力做到的事。世界的资源只有主体清单里那些。
- 不要为了戏剧性让弱者突然获胜。如果它赢了,你要在事件内容里说清是什么客观条件允许了它。

${WITNESS_VOICE}`;

export function buildAdjudicationPrompt(input: {
  session: WorldSimSession;
  reports: EntitySimulationReport[];
  followedEntityId?: string;
  forkChoiceNote?: string;
  /** 玩家上一阶段在事件卡上做的取舍。它已成为条件,不是提议 */
  directives?: { title: string; label: string; note: string }[];
}): string {
  const { session, reports } = input;
  const { seed, state } = session;

  const rulesBlock = seed.hardRules
    .slice(0, 5)
    .map((rule) => `- [${rule.scope}] ${rule.statement}`)
    .join("\n");

  // 主体清单刻意压成每主体两行。目标、能力、约束的全文只服务于主体自己的推演调用,
  // 裁决器真正需要的只是"它现在什么处境、它和谁不对付"。
  const entityBlock = state.entities
    .map((entity) => {
      const relations = entity.relations
        .slice(0, 2)
        .map((relation) => {
          const target = state.entities.find((item) => item.id === relation.targetEntityId);
          return `对${target?.name ?? relation.targetEntityId}${relation.posture}`;
        })
        .join("、");
      return `- ${entity.id} ${entity.name}[${entity.kind}] 状态:${entity.status ?? "未结算"}
  目标:${entity.goals.slice(0, 2).join(";")}${relations ? ` · 关系:${relations}` : ""}`;
    })
    .join("\n");

  const reportsBlock = reports
    .map((report) => {
      const entity = state.entities.find((item) => item.id === report.entityId);
      return `▸ ${entity?.name ?? report.entityId}(id=${report.entityId})
  意图:${report.intent}
  行动:${report.actions.join(";")}`;
    })
    .join("\n\n");

  const historyBlock = session.snapshots.length
    ? session.snapshots
        .slice(-2)
        .map(
          (snapshot) =>
            `- 纪元 ${snapshot.era}(${snapshot.timeAfter.label}):${snapshot.conclusion}`,
        )
        .join("\n")
    : "(这是世界的第一个时代)";

  const forkBlock = input.forkChoiceNote
    ? `\n【历史刚刚在分叉点上做出的选择】${input.forkChoiceNote}\n所有主体接下来都必须在这一新的前提下行动。\n`
    : "";

  /**
   * 玩家的取舍块。它必须真的在后面回来,否则"选择"就只是装饰。
   * 所以这一段要写得很硬 —— 它是条件,不是建议。
   */
  const directiveBlock = (() => {
    const list = input.directives ?? [];
    if (!list.length) return "";

    const lines = list
      .map(
        (item, index) =>
          `${index + 1}. 在「${item.title}」上,观测者选了「${item.label}」—— ${item.note}`,
      )
      .join("\n");

    const hasEarlier = session.directives.length > 0;

    return `\n【观测者此前的取舍 — 已经是既成条件】
观测者不是上帝,他没有改写任何已经发生的事。但他在几个节点上替世界做了一次坍缩。
下面这些取舍请当作本阶段的既有条件来处理,它们的影响应该体现在整段历史的走向里:

${lines}
${hasEarlier ? "\n如果本段适合安排 echo(回响),优先从这些取舍里挑一条来回收。\n" : ""}`;
  })();

  return `【反事实前提】${seed.premise.statement}
分岔点:${seed.premise.divergencePoint}

【见证者】${seed.witness.name} —— ${seed.witness.role}
每条事件的 narrator.speaker 都必须填「${seed.witness.name}」。

【世界硬约束 — 违背者一律判定失败】
${rulesBlock}

【当前主体清单与状态】
${entityBlock}

【历史脉络(最近两个阶段)】
${historyBlock}
${forkBlock}${directiveBlock}
【本大阶段各主体的提议】

${reportsBlock || "(没有任何主体提交行动,请裁定世界缓慢自然演化)"}

现在请你裁决这一大阶段的历史。
填满 schema:
- beats:2 到 3 段(spanLabel、timeAfter 只需 label 与 elapsed、headline、events 每段 1-3 条、conclusion),整段首尾相接
- entityUpdates:每个主体最终一条(只有 status 与 changed)
- fork:没有分叉就填 null
- stabilized:按第十一步判断

每个事件 actorEntityIds、entityUpdates 的 entityId 都必须使用上面出现过的 id。
事件要够大(见第四步);headline 每段必填(见第五步);choices 可选,不硬凑。
${input.followedEntityId ? `\n【观测者关注】观测者正在追踪 id=${input.followedEntityId} 的主体,请让它的状态变化比别的更具体。` : ""}

只输出本大阶段的结果,不要重述主体提议,不要写任何额外解释。`;
}
