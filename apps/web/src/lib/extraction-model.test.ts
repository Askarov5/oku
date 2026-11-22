import { describe, expect, it } from "vitest";
import {
  catalogOptions,
  isModelId,
  isRunnableModel,
  modelLabel,
  toModelOptions,
  withModel,
} from "./extraction-model";

describe("isModelId", () => {
  it("accepts Gemini models as LiteLLM ids", () => {
    expect(isModelId("gemini/gemini-3.6-flash")).toBe(true);
    expect(isModelId("gemini/gemini-flash-latest")).toBe(true);
  });

  it("accepts other providers as LiteLLM ids", () => {
    expect(isModelId("openai/gpt-4.1")).toBe(true);
    expect(isModelId("anthropic/claude-sonnet-4-5")).toBe(true);
  });

  it("rejects an unknown provider and anything that is not an id", () => {
    expect(isModelId("gemini-3.6-flash")).toBe(false);
    expect(isModelId("cohere/command")).toBe(false);
    expect(isModelId("gemini/")).toBe(false);
    expect(isModelId("gemini/Gemini 3.6")).toBe(false);
    expect(isModelId("gemini/x; drop table books")).toBe(false);
    expect(isModelId(null)).toBe(false);
    expect(isModelId(42)).toBe(false);
  });
});

describe("modelLabel", () => {
  it("shows the model's own name", () => {
    expect(modelLabel("gemini/gemini-3.6-flash")).toBe("gemini-3.6-flash");
    expect(modelLabel("openai/gpt-4.1")).toBe("gpt-4.1");
  });
});

describe("catalogOptions", () => {
  const keys = { gemini: "", openai: "", anthropic: "" };

  it("adds a provider only when its key is set", () => {
    const ids = catalogOptions(null, { ...keys, openai: "sk-test" }).map(
      (option) => option.id,
    );
    expect(ids).toContain("gemini/gemini-3.6-flash");
    expect(ids).toContain("openai/gpt-4.1");
    expect(ids.some((id) => id.startsWith("anthropic/"))).toBe(false);
  });
});

describe("isRunnableModel", () => {
  const keys = { gemini: "", openai: "", anthropic: "" };

  it("allows Gemini without a key and other providers only with one", () => {
    expect(isRunnableModel("gemini/gemini-3.6-flash", keys)).toBe(true);
    expect(isRunnableModel("openai/gpt-4.1", keys)).toBe(false);
    expect(isRunnableModel("openai/gpt-4.1", { ...keys, openai: "sk-test" })).toBe(
      true,
    );
    expect(isRunnableModel("cohere/command", keys)).toBe(false);
  });
});

describe("toModelOptions", () => {
  const generate = ["generateContent", "countTokens"];

  it("keeps the models that can read a page, in name order", () => {
    const options = toModelOptions([
      { name: "models/gemini-3.10-flash", supportedGenerationMethods: generate },
      { name: "models/gemini-3.8-flash", supportedGenerationMethods: generate },
      { name: "models/gemini-4-neon", supportedGenerationMethods: generate },
      { name: "models/gemini-3.8-flash", supportedGenerationMethods: generate },
    ]);
    expect(options.map((option) => option.label)).toEqual([
      "gemini-3.8-flash",
      "gemini-3.10-flash",
      "gemini-4-neon",
    ]);
    expect(options[0]?.id).toBe("gemini/gemini-3.8-flash");
  });

  it("leaves out models that do not turn a page into text", () => {
    const options = toModelOptions([
      { name: "models/gemini-3.8-flash-tts", supportedGenerationMethods: generate },
      { name: "models/gemini-2.5-flash-image", supportedGenerationMethods: generate },
      { name: "models/gemini-3.1-flash-image-preview", supportedGenerationMethods: generate },
      { name: "models/gemini-nano-banana-2.1", supportedGenerationMethods: generate },
      { name: "models/gemini-embedding-2", supportedGenerationMethods: ["embedContent"] },
      { name: "models/gemma-4", supportedGenerationMethods: generate },
      { name: "models/gemini-3.6-flash" },
      {},
    ]);
    expect(options).toEqual([]);
  });
});

describe("withModel", () => {
  const options = toModelOptions([
    { name: "models/gemini-3.6-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
  ]);

  it("adds a saved model that Google no longer lists", () => {
    const labels = withModel(options, "gemini/gemini-2.5-flash").map(
      (option) => option.label,
    );
    expect(labels).toEqual([
      "gemini-2.5-flash",
      "gemini-3.6-flash",
      "gemini-3.8-flash",
    ]);
  });

  it("changes nothing when the model is listed or not set", () => {
    expect(withModel(options, "gemini/gemini-3.6-flash")).toBe(options);
    expect(withModel(options, null)).toBe(options);
  });
});
