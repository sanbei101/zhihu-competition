import { z } from "zod";

import { generateObservationOptions } from "@/app/world/actions/observations";
import { errorResponse, publicError } from "@/lib/app-error";
import { eraSnapshotSchema, observationOptionSchema, worldStateSchema } from "@/lib/world-sim";

const requestSchema = z.object({
  worldState: worldStateSchema,
  history: z.array(eraSnapshotSchema).max(20),
  focusEntityId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const input: unknown = await request.json();
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success)
      return errorResponse(publicError("INVALID_REQUEST", "观测状态不完整", false), 400);
    const options = await generateObservationOptions({
      state: parsed.data.worldState,
      history: parsed.data.history,
      focusEntityId: parsed.data.focusEntityId,
    });
    return Response.json({
      options: options.map((option) => observationOptionSchema.parse(option)),
    });
  } catch (error) {
    console.error("观测选项生成失败", error);
    return errorResponse(publicError("STREAM_FAILURE", "观测选项生成失败", true), 500);
  }
}
