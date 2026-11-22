import { EXTRACTION_MODEL_SETTING, appSettings } from "@oku/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthorized, unauthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  KNOWN_MODEL_OPTIONS,
  isModelId,
  withModel,
} from "@/lib/extraction-model";
import type { ExtractionModelResponse } from "@/lib/extraction-model";
import { listGeminiModels } from "@/lib/gemini-models";

interface UpdateBody {
  model?: unknown;
}

export const GET = async (request: Request): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const [row] = await getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, EXTRACTION_MODEL_SETTING))
    .limit(1);
  const model = isModelId(row?.value) ? row.value : null;

  const listed = await listGeminiModels(getEnv().geminiApiKey);
  const body: ExtractionModelResponse = {
    model,
    options: withModel(listed ?? KNOWN_MODEL_OPTIONS, model),
    listed: listed !== null,
  };
  return NextResponse.json(body);
};

export const PUT = async (request: Request): Promise<NextResponse> => {
  if (!(await isAuthorized(request))) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as UpdateBody | null;
  const model = body?.model;
  if (!isModelId(model)) {
    return NextResponse.json(
      { error: "Choose a Gemini model, for example gemini/gemini-3.6-flash" },
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
