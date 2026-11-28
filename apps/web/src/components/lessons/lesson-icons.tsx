import type { ReactElement } from "react";
import type { KahootChoiceShape } from "@/lib/lesson-studio";

export {
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  DocumentIcon,
  ExternalLinkIcon,
  FullscreenIcon,
  PlayIcon,
  PlusIcon,
  SlidesIcon,
  SparklesIcon,
  TrophyIcon,
  UploadIcon,
} from "@oku/ui";

interface ChoiceShapeMarkProps {
  shape: KahootChoiceShape;
  className?: string;
}

/* Geometric choice badges under 20px so every answer is distinguishable by shape as well as color. */
export const ChoiceShapeMark = ({
  shape,
  className = "size-4 shrink-0",
}: ChoiceShapeMarkProps): ReactElement => {
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
