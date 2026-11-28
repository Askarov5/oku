import type { CSSProperties, ReactElement } from "react";

interface GradePillProps {
  grade: 2 | 3 | 4 | 5;
  showLabel?: boolean;
}

const GRADE_VARS: Record<2 | 3 | 4 | 5, { color: string; word: string }> = {
  5: { color: "var(--grade-five)", word: "Excellent" },
  4: { color: "var(--grade-four)", word: "Good" },
  3: { color: "var(--grade-three)", word: "Satisfactory" },
  2: { color: "var(--grade-two)", word: "Needs review" },
};

export const GradePill = ({
  grade,
  showLabel = false,
}: GradePillProps): ReactElement => {
  const meta = GRADE_VARS[grade];
  const style: CSSProperties = {
    color: meta.color,
    borderColor: meta.color,
  };

  return (
    <span
      style={style}
      className="inline-flex items-center gap-1.5 rounded-[var(--rounded-xs)] border px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums"
    >
      <span>Grade {grade}</span>
      {showLabel ? <span className="font-normal">· {meta.word}</span> : null}
    </span>
  );
};
