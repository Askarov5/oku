"use client";

import { Button } from "@oku/ui";
import type { UnitBlock } from "@oku/shared-types";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { UnitBody } from "@/components/unit-body";
import { pageAnchorId } from "@/lib/book-outline";

interface LessonReadingView {
  language: "ky" | "ru" | "en";
  bookTitle: string;
  unitTitle: string;
  pageRangeLabel: string;
  headingLevel: number;
  body: UnitBlock[];
}

interface LessonBookPanelProps {
  lessonId: string;
}

const hasReadableBody = (body: UnitBlock[]): boolean =>
  body.some((block) => block.type !== "page_anchor");

export const LessonBookPanel = ({
  lessonId,
}: LessonBookPanelProps): ReactElement => {
  const [reading, setReading] = useState<LessonReadingView | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback((): void => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setReading(null);
    setFailed(false);

    const load = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/lessons/${lessonId}/reading`);
        if (!active) return;
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const data = (await response.json()) as { reading?: LessonReadingView };
        if (!data.reading) {
          setFailed(true);
          return;
        }
        setReading(data.reading);
      } catch {
        if (active) setFailed(true);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [lessonId, attempt]);

  return (
    <div className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-5 sm:px-10 sm:py-8">
      {failed ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-[var(--text-secondary)]">
            The textbook unit could not be loaded.
          </p>
          <Button variant="ghost" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : !reading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading the unit…</p>
      ) : (
        <>
          <h3 className="text-xl font-semibold tracking-[-0.01em]">
            {reading.unitTitle}
          </h3>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text-secondary)]">
            <span>{reading.bookTitle}</span>
            <span aria-hidden> · </span>
            <span>{reading.pageRangeLabel}</span>
          </p>
          <article lang={reading.language} className="mt-6">
            {hasReadableBody(reading.body) ? (
              <UnitBody
                body={reading.body}
                headingLevel={reading.headingLevel}
                pageHref={(pageNumber) => `#${pageAnchorId(pageNumber)}`}
              />
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                This unit has no reading text yet.
              </p>
            )}
          </article>
        </>
      )}
    </div>
  );
};
