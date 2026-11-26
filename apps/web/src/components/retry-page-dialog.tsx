"use client";

import { Button, Notice, fieldClass } from "@oku/ui";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { AdminDialog } from "@/components/admin-dialog";
import {
  EXTRACTION_MODEL_ENDPOINT,
  providerLabel,
  PROVIDERS,
} from "@/lib/extraction-model";
import type {
  ExtractionModelResponse,
  ModelOption,
  ProviderId,
} from "@/lib/extraction-model";
import { RETRY_INSTRUCTION_MAX } from "@/lib/retry-instruction";

export interface RetryPageChoice {
  model: string;
  instruction: string;
}

interface RetryPageDialogProps {
  /** Digitize for a stored page; Retry for a page already read. */
  mode: "retry" | "digitize";
  /** Reviewed pages are overwritten when this job runs. */
  replacesReviewed: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (choice: RetryPageChoice) => void;
}

const groupsFor = (
  options: ModelOption[],
): Array<{ provider: ProviderId; options: ModelOption[] }> =>
  PROVIDERS.flatMap((provider) => {
    const group = options.filter((option) => option.provider === provider);
    return group.length === 0 ? [] : [{ provider, options: group }];
  });

type LoadState = "loading" | "ready" | "failed";

/** Model and optional note for one page read. */
export const RetryPageDialog = ({
  mode,
  replacesReviewed,
  busy,
  onClose,
  onConfirm,
}: RetryPageDialogProps): ReactElement => {
  const [load, setLoad] = useState<LoadState>("loading");
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [listed, setListed] = useState(true);
  const [model, setModel] = useState("");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(EXTRACTION_MODEL_ENDPOINT, {
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
          if (!cancelled) setLoad("failed");
          return;
        }
        const data = (await response.json()) as ExtractionModelResponse;
        if (cancelled) return;
        setOptions(data.options);
        setListed(data.listed);
        setModel(data.model ?? "");
        setLoad("ready");
      } catch {
        if (!cancelled) setLoad("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const title = mode === "digitize" ? "Digitize page" : "Retry page";
  const confirmLabel =
    mode === "digitize"
      ? busy
        ? "Queuing…"
        : "Digitize"
      : busy
        ? "Queuing…"
        : "Retry";

  const submit = (): void => {
    if (busy) return;
    if (!model) {
      setError("Choose a model");
      return;
    }
    setError(null);
    onConfirm({ model, instruction: instruction.trim() });
  };

  return (
    <AdminDialog
      titleId="retry-page-title"
      title={title}
      description={
        replacesReviewed
          ? "This page is marked reviewed. Reading it again replaces that text."
          : "Choose the model for this read. An optional note corrects what the last read missed."
      }
      maxWidth="lg"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] px-4 py-3">
          <Button
            type="button"
            disabled={busy || load !== "ready" || !model}
            onClick={submit}
          >
            {confirmLabel}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-4 py-4">
        {load === "failed" ? (
          <Notice tone="error">
            The model list could not be loaded. Close and try again.
          </Notice>
        ) : (
          <>
            <label className="block text-sm">
              <span className="font-medium">Model</span>
              <select
                className={`${fieldClass} mt-1.5 font-mono`}
                value={model}
                disabled={busy || load === "loading"}
                required
                onChange={(event) => {
                  setModel(event.target.value);
                  setError(null);
                }}
              >
                {load === "loading" ? (
                  <option value="">Loading…</option>
                ) : (
                  <option value="" disabled>
                    Choose a model
                  </option>
                )}
                {groupsFor(options).map((group) => (
                  <optgroup
                    key={group.provider}
                    label={providerLabel(group.provider)}
                  >
                    {group.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {load === "ready" && !listed ? (
              <Notice>
                Google&apos;s model list could not be loaded, so only a few known
                models are shown.
              </Notice>
            ) : null}
            <label className="block text-sm">
              <span className="font-medium">Note for this read</span>
              <textarea
                className={`${fieldClass} mt-1.5 min-h-[4.5rem] resize-y`}
                value={instruction}
                maxLength={RETRY_INSTRUCTION_MAX}
                disabled={busy}
                placeholder="What the last read missed — a skipped map, a table read as prose…"
                onChange={(event) => setInstruction(event.target.value)}
              />
              <span className="mt-1 block font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                {instruction.length}/{RETRY_INSTRUCTION_MAX}
              </span>
            </label>
          </>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </AdminDialog>
  );
};
