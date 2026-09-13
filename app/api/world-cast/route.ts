import { errorResponse, publicError } from "@/lib/app-error";
import { getCastPreset } from "@/lib/presets";
import { worldCastRequestSchema } from "@/lib/world-cast";

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldCastRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界线信息不完整", false), 400);
  }

  const { scenarioId, excludePresetId } = parsedInput.data;
  const lookup = getCastPreset({ scenarioId, excludePresetId });

  return Response.json({
    ok: true,
    data: {
      cast: lookup.preset.cast,
      presetId: lookup.preset.id,
      totalInPool: lookup.totalInPool,
      currentIndex: lookup.currentIndex,
    },
  });
}
