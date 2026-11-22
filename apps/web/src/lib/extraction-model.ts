/*
 * The model that reads pages. It is stored as a LiteLLM id
 * ("gemini/gemini-3.6-flash"), which is what the AI worker passes on and what
 * each extracted page records.
 */

export interface ModelOption {
  /** LiteLLM id, as stored. */
  id: string;
  /** The model's name at Google, as shown to the admin. */
  label: string;
}

export interface ExtractionModelResponse {
  /** Null until a model has been saved. */
  model: string | null;
  options: ModelOption[];
  /** False when Google's list could not be loaded and `options` is the short built-in list. */
  listed: boolean;
}

/** The parts of an entry in Google's model list that are used here. */
export interface GoogleModel {
  name?: string;
  supportedGenerationMethods?: string[];
}

const PROVIDER_PREFIX = "gemini/";

// The worker holds a Gemini key only, so only Gemini models can run.
const MODEL_ID = /^gemini\/[a-z0-9][a-z0-9.-]{1,79}$/;

// Models that answer generateContent but do not read a page into text:
// speech, image generation, live audio, embeddings, device control.
const NOT_FOR_PAGES =
  /(^|-)(tts|image|nano-banana|audio|live|embedding|robotics|computer-use)(-|$)/;

export const isModelId = (value: unknown): value is string =>
  typeof value === "string" && MODEL_ID.test(value);

export const modelLabel = (id: string): string =>
  id.startsWith(PROVIDER_PREFIX) ? id.slice(PROVIDER_PREFIX.length) : id;

const toOption = (id: string): ModelOption => ({ id, label: modelLabel(id) });

const byLabel = (a: ModelOption, b: ModelOption): number =>
  a.label.localeCompare(b.label, "en", { numeric: true });

/** Offered when Google's list is unavailable. */
export const KNOWN_MODEL_OPTIONS: ModelOption[] = [
  "gemini/gemini-3.5-flash-lite",
  "gemini/gemini-3.6-flash",
  "gemini/gemini-3.8-flash",
].map(toOption);

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

/** The options with the saved model among them, so the select can always show it. */
export const withModel = (
  options: ModelOption[],
  model: string | null,
): ModelOption[] =>
  model === null || options.some((option) => option.id === model)
    ? options
    : [...options, toOption(model)].sort(byLabel);
