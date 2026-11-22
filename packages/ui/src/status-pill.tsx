import type { CSSProperties, ReactElement } from "react";

export type StatusTone =
  | "pending"
  | "extracted"
  | "reviewed"
  | "failed"
  | "queued"
  | "running"
  | "completed"
  | "draft"
  | "review"
  | "published";

type StatusGroup = "waiting" | "active" | "done" | "failed";

/*
 * Four readings, told apart by fill and outline as well as hue:
 * waiting recedes into the hairline, active is a cobalt outline,
 * done is a solid cobalt stamp, failed is the only warm mark.
 */
const groupStyle: Record<StatusGroup, CSSProperties> = {
  waiting: {
    color: "var(--status-pending)",
    borderColor: "var(--status-pending-line)",
    backgroundColor: "transparent",
  },
  active: {
    color: "var(--status-extracted)",
    borderColor: "var(--status-extracted)",
    backgroundColor: "transparent",
  },
  done: {
    color: "var(--status-reviewed-on)",
    borderColor: "var(--status-reviewed-fill)",
    backgroundColor: "var(--status-reviewed-fill)",
  },
  failed: {
    color: "var(--status-failed)",
    borderColor: "var(--status-failed)",
    backgroundColor: "transparent",
  },
};

const toneGroup: Record<StatusTone, StatusGroup> = {
  pending: "waiting",
  queued: "waiting",
  draft: "waiting",
  extracted: "active",
  running: "active",
  review: "active",
  reviewed: "done",
  completed: "done",
  published: "done",
  failed: "failed",
};

export interface StatusPillProps {
  status: StatusTone;
  label?: string;
}

export const StatusPill = ({
  status,
  label,
}: StatusPillProps): ReactElement => (
  <span
    className="inline-flex items-center rounded-[var(--rounded-sm)] border px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs tracking-wide"
    style={groupStyle[toneGroup[status]]}
  >
    {label ?? status}
  </span>
);
