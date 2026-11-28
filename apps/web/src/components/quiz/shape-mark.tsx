import type { ReactElement } from "react";
import type { QuizChoiceShape } from "@/lib/quiz";

interface ShapeMarkProps {
  shape: QuizChoiceShape;
  className?: string;
}

export const ShapeMark = ({
  shape,
  className = "size-4 shrink-0",
}: ShapeMarkProps): ReactElement => {
  if (shape === "triangle") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
        <path d="M8 2.2 14.2 13.5H1.8L8 2.2Z" />
      </svg>
    );
  }
  if (shape === "diamond") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
        <path d="M8 1.5 14.5 8 8 14.5 1.5 8 8 1.5Z" />
      </svg>
    );
  }
  if (shape === "circle") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
        <circle cx="8" cy="8" r="5.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
    </svg>
  );
};

export const CHOICE_BUTTON_CLASS: Record<QuizChoiceShape, string> = {
  triangle:
    "bg-[var(--choice-a)] text-[var(--on-choice)] hover:bg-[var(--choice-a-hover)]",
  diamond:
    "bg-[var(--choice-b)] text-[var(--on-choice)] hover:bg-[var(--choice-b-hover)]",
  circle:
    "bg-[var(--choice-c)] text-[var(--on-choice)] hover:bg-[var(--choice-c-hover)]",
  square:
    "bg-[var(--choice-d)] text-[var(--on-choice)] hover:bg-[var(--choice-d-hover)]",
};
