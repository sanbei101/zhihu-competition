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

export const FINALE_VOICE_RULES = `写作纪律(每一条都必须遵守):
- 除了楔子开头那一段旁白,通篇第一人称,用'我'指代自己;提到别人一律用他们的姓名与身份,绝对不许出现'玩家''AI''Agent''系统''选项'这类词。
- 只写推演记录里真实发生过的事。不许编造新的史实、新的人物、新的结局,人物只能用记录里出现过的名字。
- 每一章都要落在具体场景里:谁站在哪里、说了哪句话、你有什么身体反应与心里翻覆。不许写成战报罗列。
- 语言克制、具体、有体温,允许犹豫、自嘲与后悔。不许用'综上所述''首先其次''不难看出'这类腔调,也不许分点罗列。
- 简体中文。`;

export const finalePlanInstructions = (
  chapterCount: number,
) => `你在替一位亲历者代笔,写成一篇发在知乎上的第一人称亲历故事--开头有楔子,然后分章往下讲。你先把楔子、卷目和判词定下来,正文会由你分章续写。

篇幅预算:楔子加正文合计 ${FINALE_TARGET_CHARS} 字左右。宁可写得准,不要写得多。

三件事:
1. 判决信息:verdictTitle(一句话标题)、verdictLine(一句话点评)、rating(S/A/B/C)、privateGoalVerdict(达成/部分达成/未达成)、privateGoalNote(一到两句依据)。私密目标的判定要严格,只根据记录里真实发生的事。
2. 楔子(两拍合计约 ${FINALE_PROLOGUE_CHARS} 字):
   prologue 是旁白。就像这个故事正要开场那样,先把时间、地点、正在发生的危机和当时的空气交代出来--天色、声音、谁的电话在响、屏幕上跳出了什么。旁白腔,克制、有画面,可以用'你',但不许出现'我'。
   selfIntro 紧接旁白换成第一人称:以'我是……'开头,交代自己是谁、什么身份、手里攥着什么、当时站在哪一边,再说明为什么隔了这么久才决定把这件事写下来。要把读者当成完全不知道这段历史的人来介绍,别写成履历。
3. chapters(全部卷目):从序到跋,恰好 ${chapterCount} 章。每章给出 title 与 brief--brief 必须点明这一章写哪个场景、哪次交锋、谁说了哪句关键的话、你的心里怎么翻覆,要具体到能被直接扩写成 ${finaleChapterTargetFor(chapterCount)} 字上下。不许出现'叙述战况''描写局势'这种空话。

${FINALE_VOICE_RULES}`;

export const finaleChapterInstructions = (
  chapterCount: number,
) => `你在替一位亲历者写他的自述。现在只写其中一章,不是全篇。

${FINALE_VOICE_RULES}

本章额外要求:
- 严格按这一章的 brief 来写:场景、对话、动作、心理活动,一样都不能省。
- 必须承接上一章的结尾(会附上上一章的末尾原文),让读者感觉是同一个人一口气写下来的。不要重复上一章已经交代过的事。
- 楔子已经写定,你只写这一章的正文。全篇共 ${chapterCount} 章,本章写到 ${finaleChapterTargetFor(chapterCount)} 字上下即可(不少于 ${FINALE_CHAPTER_MIN_CHARS} 字)。写不够就继续展开场景、对话与内心活动,绝对不许提前收尾、不许用一句总结草草带过;写够了就收,不必硬凑。
- 不要写小标题,不要分点,就是连续的自述散文,允许自然分段。`;

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
}) => `知乎脑洞副本:${input.scenarioTitle}
自述者:${input.player.name}(${input.player.identity})
最终结局:${input.ending.title} -- ${input.ending.reason}
终局四维:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}

全篇共 ${input.chapterCount} 章的卷目:
${input.outline.map((entry) => `${entry.index}. ${entry.title}`).join("\n")}

推演记录(事实来源,供你核对细节):
${summarizeTurnsForPrompt(input.turns, 6000)}

你只写其中第 ${input.chapter.index} 章,不要越界去写别的章。
${input.previousTail ? `上一章《${input.previousTitle}》的末尾原文(接着它往下写):\n"""\n${input.previousTail}\n"""` : "这是全篇的第一章正文,没有上一章。"}

本章标题:${input.chapter.title}
本章要写的内容:${input.chapter.brief}

请直接输出本章 title 与 markdown 正文。`;
