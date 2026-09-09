import { createDeepSeek } from "@ai-sdk/deepseek";
import { type FlexibleSchema, Output, generateText } from "ai";

/** DeepSeek 官方模型 id，集中管理。 */
export const DEEPSEEK_MODEL_ID = "deepseek-v4-flash";

/** 关闭思考模式，节省 token 并保证结构化输出稳定。 */
export const DEEPSEEK_NO_THINKING = {
  deepseek: { thinking: { type: "disabled" as const } },
};

export function getDeepSeekModel() {
  const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
  return deepseek(DEEPSEEK_MODEL_ID);
}

interface StructuredCallOptions<T> {
  instructions: string;
  prompt: string;
  schema: FlexibleSchema<T>;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

/** 结构化对象生成（generateText + Output.object），返回按 schema 解析后的对象。 */
export async function generateStructured<T>(options: StructuredCallOptions<T>): Promise<T> {
  const { output } = await generateText({
    model: getDeepSeekModel(),
    instructions: options.instructions,
    prompt: options.prompt,
    output: Output.object({ schema: options.schema }),
    providerOptions: DEEPSEEK_NO_THINKING,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    abortSignal: options.abortSignal,
  });
  return output;
}
