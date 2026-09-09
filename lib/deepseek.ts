import { createDeepSeek } from "@ai-sdk/deepseek";
import { type FlexibleSchema, Output, generateText } from "ai";

interface StructuredCallOptions<T> {
  instructions: string;
  prompt: string;
  schema: FlexibleSchema<T>;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

/** 结构化对象生成(generateText + Output.object),返回按 schema 解析后的对象。 */
export async function generateStructured<T>(options: StructuredCallOptions<T>): Promise<T> {
  const { output } = await generateText({
    model: createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY })("deepseek-v4-flash"),
    instructions: options.instructions,
    prompt: options.prompt,
    output: Output.object({ schema: options.schema }),
    providerOptions: { deepseek: { thinking: { type: "disabled" as const } } },
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    abortSignal: options.abortSignal,
  });
  return output;
}
