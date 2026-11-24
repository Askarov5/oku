/*
 * The model that reads pages. It is stored as a LiteLLM id
 * ("gemini/gemini-3.6-flash"), which is what the AI worker passes on and what
 * each extracted page records.
 *
 * Interactive calls, such as the tutor, will not go through LiteLLM. They will
 * use a provider registry at src/lib/ai/registry.ts (the Vercel AI SDK): Gemini
 * via GEMINI_API_KEY, and OpenAI or Anthropic when those keys exist, streamed
 * with streamText into a streaming Markdown renderer. Write that registry with
 * the tutor, against the installed SDK docs, not before a streamed feature exists.
 */

export const PROVIDERS = ["gemini", "openai", "anthropic"] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export interface ModelOption {
  /** LiteLLM id, as stored. */
  id: string;
  /** The model's own name, as shown to the admin. */
  label: string;
  provider: ProviderId;
}

export interface ExtractionModelResponse {
  /** Null until a model has been saved. */
  model: string | null;
  options: ModelOption[];
  /** False when Google's list could not be loaded and the Gemini options are the short built-in list. */
  listed: boolean;
}

export const EXTRACTION_MODEL_ENDPOINT = "/api/admin/settings/extraction-model";

/** Keys the server already holds. Empty means that provider is not offered. */
export interface ProviderKeys {
  gemini: string;
  openai: string;
  anthropic: string;
}

/** The parts of an entry in Google's model list that are used here. */
export interface GoogleModel {
  name?: string;
  supportedGenerationMethods?: string[];
}

const PROVIDER_PREFIX = "gemini/";

const MODEL_ID = /^(gemini|openai|anthropic)\/[a-z0-9][a-z0-9.-]{1,79}$/;

// Models that answer generateContent but do not read a page into text:
// speech, image generation, live audio, embeddings, device control.
const NOT_FOR_PAGES =
  /(^|-)(tts|image|nano-banana|audio|live|embedding|robotics|computer-use)(-|$)/;

const PROVIDER_LABEL: Record<ProviderId, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

export const isModelId = (value: unknown): value is string =>
  typeof value === "string" && MODEL_ID.test(value);

export const providerOf = (id: string): ProviderId | null => {
  const name = id.slice(0, id.indexOf("/"));
  return PROVIDERS.find((provider) => provider === name) ?? null;
};

export const providerLabel = (provider: ProviderId): string =>
  PROVIDER_LABEL[provider];

export const modelLabel = (id: string): string => {
  const slash = id.indexOf("/");
  return slash === -1 ? id : id.slice(slash + 1);
};

const toOption = (id: string): ModelOption => {
  const provider = providerOf(id);
  if (provider === null) {
    throw new Error(`Unknown model provider in ${id}`);
  }
  return { id, label: modelLabel(id), provider };
};

const byLabel = (a: ModelOption, b: ModelOption): number =>
  a.label.localeCompare(b.label, "en", { numeric: true });

/** Offered when Google's list is unavailable. */
export const KNOWN_MODEL_OPTIONS: ModelOption[] = [
  "gemini/gemini-3.5-flash-lite",
  "gemini/gemini-3.6-flash",
  "gemini/gemini-3.8-flash",
].map(toOption);

/*
 * No live list exists for these. They are vision models LiteLLM can call once
 * that provider's API key is set on the web app and on the worker.
 */
const CURATED_BY_PROVIDER: Record<Exclude<ProviderId, "gemini">, string[]> = {
  openai: ["openai/gpt-4.1", "openai/gpt-4.1-mini"],
  anthropic: ["anthropic/claude-sonnet-4-5", "anthropic/claude-haiku-4-5"],
};

/** Google's model list reduced to the models that can read a page, in name order. */
export const toModelOptions = (models: GoogleModel[]): ModelOption[] => {
  const ids = new Set<string>();
  for (const model of models) {
    const name = model.name?.replace(/^models\//, "") ?? "";
    const id = `${PROVIDER_PREFIX}${name}`;
    if (
      name.startsWith("gemini-") &&
      model.supportedGenerationMethods?.includes("generateContent") &&
      !NOT_FOR_PAGES.test(name) &&
      isModelId(id)
    ) {
      ids.add(id);
    }
  }
  return [...ids].map(toOption).sort(byLabel);
};

/**
 * Gemini from Google's list, or the short built-in list when that list is
 * missing, plus a curated list for each other provider whose key is set.
 */
export const catalogOptions = (
  geminiListed: ModelOption[] | null,
  keys: ProviderKeys,
): ModelOption[] => {
  const extras = (["openai", "anthropic"] as const).flatMap((provider) =>
    keys[provider] ? CURATED_BY_PROVIDER[provider].map(toOption) : [],
  );
  return [...(geminiListed ?? KNOWN_MODEL_OPTIONS), ...extras];
};

/** True when this id may be saved. Gemini is always allowed; other providers need their key. */
export const isRunnableModel = (id: string, keys: ProviderKeys): boolean => {
  const provider = providerOf(id);
  if (!isModelId(id) || provider === null) {
    return false;
  }
  if (provider === "gemini") {
    return true;
  }
  return keys[provider].length > 0;
};

/** The options with the saved model among them, so the select can always show it. */
export const withModel = (
  options: ModelOption[],
  model: string | null,
): ModelOption[] =>
  model === null || options.some((option) => option.id === model)
    ? options
    : [...options, toOption(model)].sort(byLabel);
