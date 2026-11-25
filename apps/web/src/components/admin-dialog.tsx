"use client";

import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type DialogWidth = "lg" | "5xl";

interface AdminDialogProps {
  titleId: string;
  title: string;
  description?: ReactNode;
  /** Action beside the title, such as the contents refresh button. */
  titleAction?: ReactNode;
  /** Extra header content under the description, such as role tabs. */
  headerExtra?: ReactNode;
  maxWidth: DialogWidth;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

const FRAME: Record<DialogWidth, string> = {
  lg: "max-h-[min(40rem,calc(100dvh-2rem))] max-w-lg",
  "5xl": "max-h-[min(48rem,calc(100dvh-2rem))] max-w-5xl",
};

/** Shared overlay and dialog frame for the library editors. */
export const AdminDialog = ({
  titleId,
  title,
  description,
  titleAction,
  headerExtra,
  maxWidth,
  busy = false,
  onClose,
  children,
  footer,
}: AdminDialogProps): ReactElement | null => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(18_22_28/0.6)] p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex w-full flex-col rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] ${FRAME[maxWidth]}`}
      >
        <div className="border-b border-[var(--border-hairline)] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {titleAction}
          </div>
          {description ? (
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              {description}
            </div>
          ) : null}
          {headerExtra}
        </div>
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  );
};
