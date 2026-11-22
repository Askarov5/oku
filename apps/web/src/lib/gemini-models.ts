import { toModelOptions } from "./extraction-model";
import type { GoogleModel, ModelOption } from "./extraction-model";

const LIST_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const CACHE_MS = 10 * 60 * 1000;
const MAX_PAGES = 5;

interface ListResponse {
  models?: GoogleModel[];
  nextPageToken?: string;
}

interface CachedList {
  at: number;
  options: ModelOption[];
}

// The list changes rarely; asking Google on every page load would only slow the admin down.
const globalForModels = globalThis as unknown as { okuGeminiModels?: CachedList };

/**
 * The models Google offers this API key for reading pages, or null when there
 * is no key or the list cannot be loaded. Server only: the key never leaves it.
 */
export const listGeminiModels = async (
  apiKey: string,
): Promise<ModelOption[] | null> => {
  if (!apiKey) {
    return null;
  }
  const cached = globalForModels.okuGeminiModels;
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.options;
  }

  try {
    const models: GoogleModel[] = [];
    let pageToken = "";
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = new URL(LIST_URL);
      url.searchParams.set("pageSize", "200");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }
      // The key travels in a header, so it cannot end up in a logged URL.
      const response = await fetch(url, {
        headers: { "x-goog-api-key": apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        console.warn(`Gemini model list: HTTP ${response.status}`);
        return null;
      }
      const data = (await response.json()) as ListResponse;
      models.push(...(data.models ?? []));
      pageToken = data.nextPageToken ?? "";
      if (!pageToken) {
        break;
      }
    }

    const options = toModelOptions(models);
    if (options.length === 0) {
      return null;
    }
    globalForModels.okuGeminiModels = { at: Date.now(), options };
    return options;
  } catch (error) {
    console.warn(
      `Gemini model list: ${error instanceof Error ? error.name : "request failed"}`,
    );
    return null;
  }
};
