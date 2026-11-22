"use client";

import { Button, Card, Notice, fieldClass } from "@oku/ui";
import type { NoticeState } from "@oku/ui";
import type { FormEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import { modelLabel } from "@/lib/extraction-model";
import type {
  ExtractionModelResponse,
  ModelOption,
} from "@/lib/extraction-model";

const ENDPOINT = "/api/admin/settings/extraction-model";

type LoadState = "loading" | "ready" | "failed";

/** Lets an admin choose the model that reads pages into text. */
export const ExtractionModelCard = (): ReactElement => {
  const [state, setState] = useState<LoadState>("loading");
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [listed, setListed] = useState(true);
  // `saved` is what the worker will use; `chosen` is what the select shows.
  const [saved, setSaved] = useState<string | null>(null);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<NoticeState | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const response = await fetch(ENDPOINT);
        if (!response.ok) {
          setState("failed");
          return;
        }
        const data = (await response.json()) as ExtractionModelResponse;
        setOptions(data.options);
        setListed(data.listed);
        setSaved(data.model);
        setChosen(data.model ?? "");
        setState("ready");
      } catch {
        setState("failed");
      }
    };
    void load();
  }, []);

  const onSave = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(ENDPOINT, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: chosen }),
      });
      const data = (await response.json()) as {
        model?: string;
        error?: string;
      };
      if (!response.ok || !data.model) {
        setMessage({
          text: data.error ?? "The model was not saved",
          tone: "error",
        });
        return;
      }
      setSaved(data.model);
      setMessage({
        text: `Saved. New extraction jobs use ${modelLabel(data.model)}.`,
        tone: "info",
      });
    } catch {
      setMessage({ text: "The model was not saved", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-sm:p-4">
      <h3 className="text-lg font-semibold">Extraction model</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Reads each page into text. A change applies to extraction jobs that
        start after it; a job already running keeps its model.
      </p>

      {state === "failed" ? (
        <Notice tone="error" className="mt-4">
          The model setting could not be loaded. Reload the page to try again.
        </Notice>
      ) : (
        <form className="mt-4 grid gap-4" onSubmit={onSave}>
          <label className="block text-sm">
            Gemini model
            <select
              className={`${fieldClass} mt-1 font-mono`}
              value={chosen}
              onChange={(event) => {
                setChosen(event.target.value);
                setMessage(null);
              }}
              disabled={state === "loading" || busy}
              required
            >
              {state === "loading" ? <option value="">Loading…</option> : null}
              {state === "ready" && saved === null ? (
                <option value="" disabled>
                  Choose a model
                </option>
              ) : null}
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {state === "ready" && !listed ? (
            <Notice>
              Google&apos;s model list could not be loaded, so only a few known
              models are shown.
            </Notice>
          ) : null}
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          <div>
            <Button
              type="submit"
              variant="ghost"
              disabled={state !== "ready" || busy || chosen === (saved ?? "")}
            >
              {busy ? "Saving…" : "Save model"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};
