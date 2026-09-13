import { type WorldCast } from "@/lib/world-cast";
import {
  FINALE_PROLOGUE_CHARS,
  FINALE_TARGET_CHARS,
  FINALE_CHAPTER_MIN_CHARS,
  describeCrisis,
  describeRelations,
  finaleChapterTargetFor,
  summarizeTurnsForPrompt,
  type AgentRelation,
  type FinaleRating,
  type TurnRecord,
  type WorldCrisis,
  type WorldMetrics,
} from "@/lib/world-ending";

type PlayerCharacter = WorldCast["playerCharacters"][number];

export const FINALE_VOICE_RULES = `[知乎体·亲历者深度长文写作纪律](每一条都必须严格遵守):
- 身份与第一人称视角:
  通篇第一人称,用'我'指代自己。你是当年这场风云变局的核心当事人、决策者或掌印人。
  提到同僚、对手或部下一律用真实姓名与身份,绝对严禁出现'玩家''AI''Agent''系统''数值''选项''回合'等打破第四面墙的词汇。
- 经典的知乎高赞答主口吻与气场:
  开篇必须具备浓郁的知乎答题质感:以当事人身份打破后世史书或局外人对这段历史的滤镜与刻板印象。
  语言老辣、克制、冷峻且有体温,具有内幕揭秘感与当事人深沉自省。允许犹疑、狠决、疲惫、自嘲与余痛。
  绝对禁止公文与AI套话(如'综上所述''总而言之''不可否认''不难看出''这不仅是...更是...'等),禁止干瘪的分点罗列,通篇必须是行云流水、富有文学与戏剧张力的高赞深度回答长文。
- 严格基于推演记录事实:
  只写推演记录中真实发生过的抉择、冲突、突发危机与人物反应。不许凭空胡编记录里不存在的关键人物或结局。
- 强烈的现场感与戏剧交锋:
  每一章必须落在具体场景与博弈交锋中:当时案几上的烛火、谁站在哪侧、谁说了哪句见血封喉的话、你在那一瞬间的心跳与权衡。把宏大历史压缩在逼仄的决策现场。
- 简体中文。`;

export const finalePlanInstructions = (
  chapterCount: number,
) => `你在替一位知乎硬核历史/脑洞高赞答主(当事亲历者)代笔,写成一篇发在知乎上的第一人称深度亲历长回答--开头有引子与自述,然后分章往下讲。你先把楔子、卷目大纲和判词定下来,正文会由你逐卷分章续写。

篇幅预算:楔子加正文合计 ${FINALE_TARGET_CHARS} 字左右。宁可写得准、写得透,不要写得多。

三件事:
1. 判决信息:
   - verdictTitle: 极具吸引力的知乎高赞回答式精辟标题(如《谢邀,人在赤壁,火烧连环船那夜我其实就在中军帐》或《在太阳熄灭前三天,我替全人类签下了那份死刑判决》)。
   - verdictLine: 一句话当事人深刻点评与宿命叹息。
   - rating: S/A/B/C。
   - privateGoalVerdict: 达成/部分达成/未达成。
   - privateGoalNote: 一到两句真实依据,只根据记录里发生的事严密判定。
2. 楔子(两拍合计约 ${FINALE_PROLOGUE_CHARS} 字):
   - prologue (局势开端): 旁白腔,冷峻定格。就像电影开场那样,先把时间、地点、正在发生的危机和当时的压迫感交代出来--天色、风向、残旗、屏幕上的警报。克制有画面,可以用'你',不许出现'我'。
   - selfIntro (答主自述破题): 紧接旁白转为纯正第一人称知乎体起手:
     必须以'谢邀。人在……,刚下……。利益相关:[当事人身份],这事就算后人不说,我也必须把大实话倒出来。'这种极具知乎高赞答主现场感的风格开场,说明自己手里当时攥着什么、站在哪一边、为什么隔了这么久才决定把这场致命博弈原原本本地复盘出来。
3. chapters (全部卷目): 从序到跋,恰好 ${chapterCount} 章。
   - 每章给出 title 与 brief。
   - title 要有知乎深度连载专栏的悬念感与内幕感(如《卷一 · 帐前的风,根本不是往东吹的》、《卷二 · 当死士拔出短刀时》)。
   - brief 必须明确本章写哪个逼仄场景、哪次言辞交锋、谁说了哪句关键的话、你的心里怎么翻覆,要具体到能被直接扩写成 ${finaleChapterTargetFor(chapterCount)} 字上下。
4. shareText (知乎动态分享卡):
   用知乎社区高赞回答的精简分享卡格式排版,包含问题标题、亲历者身份、终局评级、一句话判词和核心金句摘要。

${FINALE_VOICE_RULES}`;

export const finaleChapterInstructions = (
  chapterCount: number,
  isFinalChapter = false,
) => `你在替一位知乎高赞答主(当事人亲历者)撰写他回忆录的正文。现在只写其中一卷,不是全篇。

${FINALE_VOICE_RULES}

本章额外要求:
- 严格按这一章的 brief 展开:场景、交锋对话、动作神态、内心决断,一样都不能省。
- 必须承接上一章的结尾(附有上一章末尾原文),保持同一位亲历者的口吻自然延展,避免生硬跳跃。
- 这是连续的知乎长回答正文散文,允许自然分段,严禁写子标题,严禁分点'1. 2. 3.'罗列。
- 本章篇幅在 ${finaleChapterTargetFor(chapterCount)} 字上下(不少于 ${FINALE_CHAPTER_MIN_CHARS} 字)。
${
  isFinalChapter
    ? `- [注意:这是全篇的最后一章(终卷)]: 请在写完本卷的核心高潮与局势收束后,以知乎答主典型的沉静、苍凉且富有回味的口吻落款收尾(如'以上。手打不易,感谢阅读。如果当年坐在那个位置上的人是你,你会怎么选?欢迎在评论区聊聊。')。`
    : `- [注意:这不是最后一章]: 本章结尾请留有余波或悬念,让故事能够自然引出下一卷,绝对不许提前做全剧终结性的草草总结。`
}`;

export const buildFinalePlanPrompt = (input: {
  scenarioTitle: string;
  setting: WorldCast["setting"];
  player: PlayerCharacter;
  ending: { type: string; title: string; reason: string };
  metrics: WorldMetrics;
  fallbackRating: FinaleRating;
  turns: TurnRecord[];
  relations: AgentRelation[];
  crisis: WorldCrisis | null;
  chapterCount: number;
}) => `知乎脑洞副本:${input.scenarioTitle}
你要代笔的人:${input.player.name}(${input.player.identity}),阵营 ${input.player.faction}
他的公开目标:${input.player.publicGoal}
他的私密目标:${input.player.privateGoal}
跟他共事过的人:${input.player.relationship}

这场危机刚开始时的样子(楔子的旁白要接上这个调子,别重复原话):
时间地点:${input.setting.time} · ${input.setting.location}
危机:${input.setting.crisis}
当时的那段旁白:${input.setting.opening}

最终结局:${input.ending.title} -- ${input.ending.reason}
终局四维:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}(参考评级 ${input.fallbackRating})
共推演 ${input.turns.length} 回合,请排 ${input.chapterCount} 章。

终局各方对他的信任度:
${describeRelations(input.relations)}

未解决的突发事件:
${describeCrisis(input.crisis)}

完整推演记录(这是唯一的事实来源):
${summarizeTurnsForPrompt(input.turns, 20000)}

请输出判决信息、楔子 prologue 与 selfIntro、卷目 chapters、timeline 与 shareText。`;

export const buildFinaleChapterPrompt = (input: {
  scenarioTitle: string;
  player: PlayerCharacter;
  ending: { type: string; title: string; reason: string };
  metrics: WorldMetrics;
  turns: TurnRecord[];
  chapterCount: number;
  chapter: { index: number; title: string; brief: string };
  outline: { index: number; title: string }[];
  previousTail: string;
  previousTitle: string;
  isFinalChapter?: boolean;
}) => `知乎脑洞副本:${input.scenarioTitle}
自述者:${input.player.name}(${input.player.identity})
最终结局:${input.ending.title} -- ${input.ending.reason}
终局四维:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}

全篇共 ${input.chapterCount} 章的卷目:
${input.outline.map((entry) => `${entry.index}. ${entry.title}`).join("\n")}

推演记录(事实来源,供你核对细节):
${summarizeTurnsForPrompt(input.turns, 6000)}

你只写其中第 ${input.chapter.index} 章${input.isFinalChapter ? " (注意:这是全篇终卷)" : ""},不要越界去写别的章。
${input.previousTail ? `上一章《${input.previousTitle}》的末尾原文(接着它往下写):\n"""\n${input.previousTail}\n"""` : "这是全篇的第一章正文,没有上一章。"}

本章标题:${input.chapter.title}
本章要写的内容:${input.chapter.brief}

请直接输出本章 title 与 markdown 正文。`;
