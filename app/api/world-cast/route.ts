import { Agent } from "@mastra/core/agent";

import { worldCastRequestSchema, worldCastSchema } from "@/lib/world-cast";

const castingAgent = new Agent({
  id: "world-casting-director",
  name: "世界线选角导演",
  model: "deepseek/deepseek-v4-flash",
  instructions: `你是一名严谨的架空历史推演导演和剧本杀作者。根据知乎假设题建立第一幕角色阵容。

角色必须扎根于题目给出的时代、制度和技术条件，不能使用穿越者或全知视角来偷懒。三个玩家候选角色要拥有不同的权力来源、道德困境和玩法；四个 AI 角色要代表不同利益集团，彼此目标不能完全一致。人物关系中必须包含合作、冲突或债务，使他们在第一回合就有采取行动的理由。

不要续写完整历史，不要提前给出结局，只建立危机爆发时的舞台和可博弈角色。使用简体中文，内容具体、克制。角色 id 使用唯一的简短英文小写标识。`,
});

export async function POST(request: Request) {
  try {
    const input = worldCastRequestSchema.safeParse(await request.json());

    if (!input.success) {
      return Response.json({ error: "世界线信息不完整" }, { status: 400 });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return Response.json({ error: "服务端缺少 DEEPSEEK_API_KEY" }, { status: 500 });
    }

    const { scenarioId, title, content } = input.data;
    const response = await castingAgent.generate(
      `为下面这条世界线生成开场角色阵容。\n\n知乎问题编号：${scenarioId}\n问题：${title}\n补充描述：${content || "无"}`,
      {
        structuredOutput: {
          schema: worldCastSchema,
          jsonPromptInjection: true,
        },
        providerOptions: {
          deepseek: {
            thinking: { type: "disabled" },
          },
        },
        modelSettings: {
          temperature: 0.9,
          maxOutputTokens: 10000,
        },
      },
    );

    if (response.error) throw response.error;
    if (!response.object) {
      const rawResponse = {
        finishReason: response.finishReason,
        warnings: response.warnings,
        text: response.text || "<empty>",
        reasoningText: response.reasoningText || "<empty>",
      };
      console.error("[岔路] DeepSeek 原始返回", rawResponse);
      throw new Error(`DeepSeek 未返回结构化对象：${JSON.stringify(rawResponse, null, 2)}`);
    }

    return Response.json(worldCastSchema.parse(response.object));
  } catch (error) {
    console.error("[岔路] 角色阵容生成失败", error);
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}${error.cause instanceof Error ? `\nCaused by ${error.cause.name}: ${error.cause.message}` : ""}`
        : String(error);

    return Response.json({ error: "角色生成失败", detail }, { status: 502 });
  }
}
