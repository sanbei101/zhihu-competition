import type { ZodType } from "zod";

export async function readNdjsonStream<T>(
  response: Response,
  schema: ZodType<T>,
  onEvent: (event: T) => void,
): Promise<void> {
  if (!response.body) throw new Error("浏览器未收到响应流");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const applyLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new Error("响应流包含非法 JSON");
    }

    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new Error("响应流事件结构不匹配");
    onEvent(parsed.data);
  };

  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- 流式读取必须串行等待每个 chunk
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) applyLine(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) applyLine(buffer);
}
