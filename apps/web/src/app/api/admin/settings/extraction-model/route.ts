import { EXTRACTION_MODEL_SETTING, appSettings } from "@oku/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  catalogOptions,
  isModelId,
  isRunnableModel,
  withModel,
} from "@/lib/extraction-model";
import type { ProviderKeys } from "@/lib/extraction-model";
import type { ExtractionModelResponse } from "@/lib/extraction-model";
import { listGeminiModels } from "@/lib/gemini-models";

interface UpdateBody {
  model?: unknown;
}

export const GET = async (request: Request): Promise<NextResponse> => {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  const [row] = await getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, EXTRACTION_MODEL_SETTING))
    .limit(1);
  const model = isModelId(row?.value) ? row.value : null;

  const env = getEnv();
  const keys: ProviderKeys = {
    gemini: env.geminiApiKey,
    openai: env.openaiApiKey,
    anthropic: env.anthropicApiKey,
  };
  const listed = await listGeminiModels(keys.gemini);
  const body: ExtractionModelResponse = {
    model,
    options: withModel(catalogOptions(listed, keys), model),
    listed: listed !== null,
  };
  return NextResponse.json(body);
};

export const PUT = async (request: Request): Promise<NextResponse> => {
  const denied = await requireAdmin(request);
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => null)) as UpdateBody | null;
  const model = body?.model;
  const env = getEnv();
  const keys: ProviderKeys = {
    gemini: env.geminiApiKey,
    openai: env.openaiApiKey,
    anthropic: env.anthropicApiKey,
  };
  if (typeof model !== "string" || !isRunnableModel(model, keys)) {
    return NextResponse.json(
      {
        error:
          "Choose a model, for example gemini/gemini-3.6-flash. Other providers appear after their API key is set.",
      },
      { status: 400 },
    );
  }

  await getDb()
    .insert(appSettings)
    .values({ key: EXTRACTION_MODEL_SETTING, value: model })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: model, updatedAt: new Date() },
    });

  return NextResponse.json({ model });
};
