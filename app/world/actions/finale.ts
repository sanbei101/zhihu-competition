"use server";

import { z } from "zod";

import { fail, failParse, requireDeepSeekKey, type ActionResult } from "@/app/world/action-result";
import { publicError } from "@/lib/app-error";
import { generateStructured } from "@/lib/deepseek";
import { worldCastSchema, type WorldCast } from "@/lib/world-cast";
import {
  FINALE_CHAPTER_MAX,
  FINALE_CHAPTER_MIN,
  FINALE_CHAPTER_MIN_CHARS,
  FINALE_PROLOGUE_CHARS,
  FINALE_TARGET_CHARS,
  agentRelationSchema,
  crisisSchema,
  describeCrisis,
  describeRelations,
  finaleChapterCountFor,
  finaleChapterSchema,
  finaleChapterTargetFor,
  finalePlanSchema,
  metricsSchema,
  ratingForMetrics,
  summarizeTurnsForPrompt,
  turnRecordSchema,
  type FinaleChapter,
  type FinalePlan,
  type FinaleRating,
  type TurnRecord,
  type WorldMetrics,
} from "@/lib/world-ending";

const FINALE_VOICE_RULES = `写作纪律(每一条都必须遵守):
- 除了楔子开头那一段旁白,通篇第一人称,用'我'指代自己;提到别人一律用他们的姓名与身份,绝对不许出现'玩家''AI''Agent''系统''选项'这类词。
- 只写推演记录里真实发生过的事。不许编造新的史实、新的人物、新的结局,人物只能用记录里出现过的名字。
- 每一章都要落在具体场景里:谁站在哪里、说了哪句话、你有什么身体反应与心里翻覆。不许写成战报罗列。
- 语言克制、具体、有体温,允许犹豫、自嘲与后悔。不许用'综上所述''首先其次''不难看出'这类腔调,也不许分点罗列。
- 简体中文。`;

const finalePlanInstructions = (
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

const finaleChapterInstructions = (
  chapterCount: number,
) => `你在替一位亲历者写他的自述。现在只写其中一章,不是全篇。

${FINALE_VOICE_RULES}

本章额外要求:
- 严格按这一章的 brief 来写:场景、对话、动作、心理活动,一样都不能省。
- 必须承接上一章的结尾(会附上上一章的末尾原文),让读者感觉是同一个人一口气写下来的。不要重复上一章已经交代过的事。
- 楔子已经写定,你只写这一章的正文。全篇共 ${chapterCount} 章,本章写到 ${finaleChapterTargetFor(chapterCount)} 字上下即可(不少于 ${FINALE_CHAPTER_MIN_CHARS} 字)。写不够就继续展开场景、对话与内心活动,绝对不许提前收尾、不许用一句总结草草带过;写够了就收,不必硬凑。
- 不要写小标题,不要分点,就是连续的自述散文,允许自然分段。`;

const buildFinalePlanPrompt = (input: {
  scenarioTitle: string;
  setting: WorldCast["setting"];
  player: WorldCast["playerCharacters"][number];
  ending: { type: string; title: string; reason: string };
  metrics: WorldMetrics;
  fallbackRating: FinaleRating;
  turns: TurnRecord[];
  relations: z.infer<typeof agentRelationSchema>[];
  crisis: z.infer<typeof crisisSchema> | null;
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

const buildFinaleChapterPrompt = (input: {
  scenarioTitle: string;
  player: WorldCast["playerCharacters"][number];
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

全篇共 ${input.chapterCount} 章的卷目(你只写其中第 ${input.chapter.index} 章,不要越界去写别的章):
${input.outline.map((entry) => `${entry.index}. ${entry.title}`).join("\n")}

  ${input.previousTail ? `上一章《${input.previousTitle}》的末尾原文(接着它往下写):\n"""\n${input.previousTail}\n"""\n` : "这是全篇的第一章正文,没有上一章。"}

本章标题:${input.chapter.title}
本章要写的内容:${input.chapter.brief}

推演记录(事实来源,供你核对细节):
${summarizeTurnsForPrompt(input.turns, 6000)}

请直接输出本章 title 与 markdown 正文。`;

const generateFinalePlanInputSchema = z.object({
  scenarioId: z.string().min(1).max(100),
  scenarioTitle: z.string().min(1).max(300),
  scenarioUrl: z.string().max(500),
  cast: worldCastSchema,
  playerId: z.string().min(1),
  turns: z.array(turnRecordSchema).min(1),
  metrics: metricsSchema,
  relations: z.array(agentRelationSchema),
  crisis: crisisSchema.nullable(),
  ending: z.object({ type: z.string(), title: z.string(), reason: z.string() }),
});

export async function generateFinalePlanAction(input: unknown): Promise<ActionResult<FinalePlan>> {
  const parsed = generateFinalePlanInputSchema.safeParse(input);
  if (!parsed.success) return failParse("结算", parsed.error);
  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

  const { scenarioTitle, cast, playerId, turns, metrics, ending, relations, crisis } = parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail(publicError("NOT_FOUND", "玩家角色不存在", false));
  const chapterCount = finaleChapterCountFor(turns.length);

  try {
    const object = await generateStructured({
      instructions: finalePlanInstructions(chapterCount),
      prompt: buildFinalePlanPrompt({
        scenarioTitle,
        setting: cast.setting,
        player,
        ending,
        metrics,
        fallbackRating: ratingForMetrics(metrics),
        turns,
        relations,
        crisis,
        chapterCount,
      }),
      schema: finalePlanSchema,
      temperature: 0.75,
      maxOutputTokens: 3000,
    });
    const plan = finalePlanSchema.parse(object);
    const chapters = plan.chapters
      .slice(0, Math.max(chapterCount, FINALE_CHAPTER_MIN))
      .map((chapter, index) => ({ index: index + 1, title: chapter.title, brief: chapter.brief }));
    return { ok: true, data: { ...plan, chapters } };
  } catch (error) {
    console.error("终章卷目生成失败", error);
    return fail(publicError("UPSTREAM_FAILURE", "终章卷目生成失败,请重试", true));
  }
}

const generateFinaleChapterInputSchema = z.object({
  scenarioId: z.string().min(1).max(100),
  scenarioTitle: z.string().min(1).max(300),
  cast: worldCastSchema,
  playerId: z.string().min(1),
  turns: z.array(turnRecordSchema).min(1),
  metrics: metricsSchema,
  ending: z.object({ type: z.string(), title: z.string(), reason: z.string() }),
  chapterCount: z.number().int().min(1).max(FINALE_CHAPTER_MAX),
  chapter: z.object({
    index: z.number().int().min(1),
    title: z.string().min(1).max(40),
    brief: z.string().min(1).max(300),
  }),
  outline: z.array(z.object({ index: z.number().int().min(1), title: z.string() })).min(1),
  previousTitle: z.string().max(40),
  previousTail: z.string().max(4000),
});

export async function generateFinaleChapterAction(
  input: unknown,
): Promise<ActionResult<FinaleChapter>> {
  const parsed = generateFinaleChapterInputSchema.safeParse(input);
  if (!parsed.success) return failParse("章节", parsed.error);
  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

  const { scenarioTitle, cast, playerId, turns, metrics, ending, chapterCount, chapter } =
    parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail(publicError("NOT_FOUND", "玩家角色不存在", false));

  try {
    const object = await generateStructured({
      instructions: finaleChapterInstructions(chapterCount),
      prompt: buildFinaleChapterPrompt({
        scenarioTitle,
        player,
        ending,
        metrics,
        turns,
        chapterCount,
        chapter,
        outline: parsed.data.outline,
        previousTail: parsed.data.previousTail,
        previousTitle: parsed.data.previousTitle,
      }),
      schema: finaleChapterSchema,
      temperature: 0.85,
      maxOutputTokens: 3000,
    });
    return { ok: true, data: finaleChapterSchema.parse(object) };
  } catch (error) {
    console.error(`终章第 ${chapter.index} 章生成失败`, error);
    return fail(publicError("UPSTREAM_FAILURE", `第 ${chapter.index} 章生成失败,请重试`, true));
  }
}
