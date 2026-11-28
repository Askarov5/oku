"use client";

import { buttonClasses, ChevronDownIcon } from "@oku/ui";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { PlusIcon } from "@/components/lessons/lesson-icons";
import type { QuizItemKind } from "@/lib/quiz";
import { QUIZ_KIND_OPTIONS } from "./quiz-kinds";

interface AddQuizQuestionButtonProps {
  disabled?: boolean;
  onAdd: (kind: QuizItemKind) => void;
}

export const AddQuizQuestionButton = ({
  disabled = false,
  onAdd,
}: AddQuizQuestionButtonProps): ReactElement => {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const closeMenu = (restoreFocus: boolean): void => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (kind: QuizItemKind): void => {
    setOpen(false);
    onAdd(kind);
    triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const items = itemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={buttonClasses({ variant: "ghost", size: "sm" })}
        onClick={() => setOpen((current) => !current)}
      >
        <PlusIcon />
        Add question
        <ChevronDownIcon
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Question type"
          className="absolute left-0 z-30 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 sm:left-auto sm:right-0"
          onKeyDown={onMenuKeyDown}
        >
          {QUIZ_KIND_OPTIONS.map((option, index) => (
            <button
              key={option.kind}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full flex-col items-start justify-center rounded-[var(--rounded-xs)] px-3 py-2 text-left hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)]"
              onClick={() => choose(option.kind)}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                {option.detail}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
