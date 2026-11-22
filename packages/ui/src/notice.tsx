import type { ReactElement, ReactNode } from "react";

export type NoticeTone = "info" | "error";

export interface NoticeState {
  text: string;
  tone: NoticeTone;
}

export interface NoticeProps {
  tone?: NoticeTone;
  className?: string;
  children: ReactNode;
}

const toneClass: Record<NoticeTone, string> = {
  info: "text-[var(--text-secondary)]",
  error: "font-medium text-[var(--status-failed)]",
};

export const Notice = ({
  tone = "info",
  className = "",
  children,
}: NoticeProps): ReactElement => (
  <p
    role={tone === "error" ? "alert" : "status"}
    className={`text-sm ${toneClass[tone]} ${className}`.trim()}
  >
    {children}
  </p>
);
