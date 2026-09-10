import { Output, streamText } from "ai";

import {
  JSON_ONLY_INSTRUCTION,
  hasLlmKey,
  llmModel,
  llmProviderOptions,
  missingLlmKeyMessage,
  salvageStructuredOutput,
} from "@/lib/deepseek";
import {
  agentCharacterSchema,
  playerCharacterSchema,
  worldCastRequestSchema,
  worldCastSchema,
  worldSettingSchema,
  type WorldCastStreamEvent,
} from "@/lib/world-cast";
import { CAST_INSTRUCTIONS, buildCastPrompt } from "@/lib/world-prompts";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "请求不是有效的 JSON" }, { status: 400 });
  }

  const parsedInput = worldCastRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return Response.json({ error: "世界线信息不完整" }, { status: 400 });
  }
  if (!hasLlmKey()) {
    return Response.json({ error: missingLlmKeyMessage() }, { status: 500 });
  }

  const { scenarioId, title, content } = parsedInput.data;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: WorldCastStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void (async () => {
        try {
          const result = streamText({
            model: llmModel(),
            instructions: `${CAST_INSTRUCTIONS}${JSON_ONLY_INSTRUCTION}`,
            prompt: buildCastPrompt({ scenarioId, title, content }),
            output: Output.object({ schema: worldCastSchema }),
            providerOptions: llmProviderOptions(),
            temperature: 0.6,
            maxOutputTokens: 14000,
            abortSignal: request.signal,
          });

          let settingSent = false;
          const sentCharacters = new Set<string>();

          for await (const partial of result.partialOutputStream) {
            if (!settingSent) {
              const setting = worldSettingSchema.safeParse(partial.setting);
              if (setting.success) {
                settingSent = true;
                send({ type: "setting", setting: setting.data });
              }
            }

            if (Array.isArray(partial.playerCharacters)) {
              for (const candidate of partial.playerCharacters) {
                const character = playerCharacterSchema.safeParse(candidate);
                if (character.success && !sentCharacters.has(`player:${character.data.id}`)) {
                  sentCharacters.add(`player:${character.data.id}`);
                  send({ type: "player-character", character: character.data });
                }
              }
            }

            if (Array.isArray(partial.agentCharacters)) {
              for (const candidate of partial.agentCharacters) {
                const character = agentCharacterSchema.safeParse(candidate);
                if (character.success && !sentCharacters.has(`agent:${character.data.id}`)) {
                  sentCharacters.add(`agent:${character.data.id}`);
                  send({ type: "agent-character", character: character.data });
                }
              }
            }
          }

          const cast = worldCastSchema.parse(await result.output);
          send({ type: "complete", cast });
          controller.close();
        } catch (error) {
          if (request.signal.aborted) {
            controller.close();
            return;
          }

          // 中转站爱把 JSON 包进 ```json 围栏,原生解析会失败但内容其实是好的。
          const salvaged = salvageStructuredOutput(error, worldCastSchema);
          if (salvaged) {
            console.warn("角色阵容走兜底解析成功", error);
            send({ type: "complete", cast: salvaged });
            controller.close();
            return;
          }

          console.error("流式角色阵容生成失败", error);
          send({
            type: "error",
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          });
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
