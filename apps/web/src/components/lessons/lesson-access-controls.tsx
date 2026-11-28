"use client";

import { Button, CheckIcon, CopyIcon, DocumentIcon } from "@oku/ui";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import type { LessonAccess, LessonWorkspace } from "@/lib/lesson-studio";
import { accessLabel, lessonHasMaterials } from "@/lib/lesson-studio";

interface LessonAccessControlsProps {
  workspace: LessonWorkspace;
  onAccessChange: (access: LessonAccess) => Promise<void>;
}

interface ShareAction {
  kind: "quiz" | "lesson";
  label: string;
  href: string;
  copied: string;
  failed: string;
}

interface AccessNotice {
  tone: "ok" | "error";
  text: string;
  href?: string;
}

interface ShareIconButtonProps {
  action: ShareAction;
  onNotice: (notice: AccessNotice) => void;
}

interface AccessNoticeTextProps {
  notice: AccessNotice;
}

interface HoverLabelProps {
  children: ReactElement;
  panel: ReactNode;
  align?: "start" | "end";
}

interface ConfirmAccessProps {
  access: LessonAccess;
  pending: LessonAccess;
  busy: boolean;
  onKeep: () => void;
  onSwitch: () => void;
}

const ACCESS_ORDER: LessonAccess[] = ["draft", "private", "public"];

const ACCESS_RANK: Record<LessonAccess, number> = {
  draft: 0,
  private: 1,
  public: 2,
};

const narrowsAccess = (from: LessonAccess, to: LessonAccess): boolean =>
  ACCESS_RANK[to] < ACCESS_RANK[from];

const confirmCopy = (from: LessonAccess, to: LessonAccess): string => {
  if (to === "draft" && from === "public") {
    return "Draft turns off the lesson link and the quiz link. Anyone using them will lose access.";
  }
  if (to === "draft") {
    return "Draft turns off the quiz link. Students using it will not be able to open the quiz.";
  }
  return "Private hides the lesson page. Anyone with that link will not be able to open the slides and plan. The quiz link keeps working.";
};

const accessExplanation = (access: LessonAccess): string => {
  if (access === "private") {
    return "Students with the quiz link can take it. Draft turns that link off. Public opens the lesson page.";
  }
  if (access === "public") {
    return "Anyone with the lesson link can open the slides and plan. Draft turns these links off.";
  }
  return "Only you can open this lesson. Private shares the quiz link. Public opens the lesson page.";
};

const copyText = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

const segmentClass = (selected: boolean): string =>
  [
    "inline-flex min-h-9 min-w-0 items-center px-2 text-sm font-semibold coarse:min-h-11",
    "border-y border-r border-[var(--border-control)] first:rounded-l-[var(--rounded-xs)] first:border-l last:rounded-r-[var(--rounded-xs)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    selected
      ? "bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
      : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
  ].join(" ");

/** Shows helper copy on hover and keyboard focus without taking a line in the toolbar. */
export const HoverLabel = ({
  children,
  panel,
  align = "start",
}: HoverLabelProps): ReactElement => (
  <span className="group/tip relative inline-flex">
    {children}
    {panel ? (
      <span
        aria-hidden
        className={`absolute top-full z-30 hidden pt-1 group-hover/tip:block group-focus-within/tip:block ${
          align === "end" ? "right-0" : "left-0"
        }`}
      >
        <span className="block w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm leading-5 text-[var(--text-primary)]">
          {panel}
        </span>
      </span>
    ) : null}
  </span>
);

const ShareIconButton = ({
  action,
  onNotice,
}: ShareIconButtonProps): ReactElement => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <HoverLabel
      align="end"
      panel={copied ? action.copied : action.label}
    >
      <Button
        variant="ghost"
        size="sm"
        className="px-2 coarse:min-h-11 coarse:min-w-11"
        aria-label={copied ? action.copied : action.label}
        onClick={() => {
          void (async () => {
            const ok = await copyText(action.href);
            if (ok) {
              setCopied(true);
              if (timer.current !== null) window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => setCopied(false), 2000);
              onNotice({ tone: "ok", text: action.copied });
              return;
            }
            setCopied(false);
            onNotice({
              tone: "error",
              text: action.failed,
              href: action.href,
            });
          })();
        }}
      >
        {copied ? (
          <CheckIcon />
        ) : action.kind === "lesson" ? (
          <DocumentIcon />
        ) : (
          <CopyIcon />
        )}
      </Button>
    </HoverLabel>
  );
};

const AccessNoticeText = ({ notice }: AccessNoticeTextProps): ReactElement =>
  notice.tone === "error" ? (
    <div className="order-1 block w-full min-w-0 max-w-sm basis-full">
      <p
        role="status"
        className="text-sm leading-5 text-[var(--status-failed)]"
      >
        {notice.text}
      </p>
      {notice.href ? (
        <p className="mt-1 break-all font-[family-name:var(--font-mono)] text-xs leading-5 text-[var(--text-primary)]">
          {notice.href}
        </p>
      ) : null}
    </div>
  ) : (
    <p role="status" className="sr-only">
      {notice.text}
    </p>
  );

const ConfirmAccess = ({
  access,
  pending,
  busy,
  onKeep,
  onSwitch,
}: ConfirmAccessProps): ReactElement => (
  <div className="order-1 block w-full min-w-0 max-w-sm basis-full">
    <p role="status" className="text-sm font-medium leading-5">
      {confirmCopy(access, pending)}
    </p>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button variant="ghost" size="sm" disabled={busy} onClick={onKeep}>
        {`Keep ${accessLabel(access).toLowerCase()}`}
      </Button>
      <Button variant="secondary" size="sm" disabled={busy} onClick={onSwitch}>
        {`Switch to ${accessLabel(pending).toLowerCase()}`}
      </Button>
    </div>
  </div>
);

export const LessonAccessControls = ({
  workspace,
  onAccessChange,
}: LessonAccessControlsProps): ReactElement | null => {
  const explanationId = useId();
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<AccessNotice | null>(null);
  const [pending, setPending] = useState<LessonAccess | null>(null);
  const [tabAccess, setTabAccess] = useState<LessonAccess>(
    workspace.access ?? "draft",
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const ready = lessonHasMaterials(workspace);
  const access = workspace.access ?? "draft";

  useEffect(() => {
    setTabAccess(access);
  }, [access]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const quizHref = `${origin}/play/${workspace.shareCode}`;
  const lessonHref = `${origin}/lesson/${workspace.shareCode}`;

  const quizAction: ShareAction = {
    kind: "quiz",
    label: "Copy student quiz link",
    href: quizHref,
    copied: "Student quiz link copied.",
    failed:
      "Could not copy the student quiz link. Select the address below and copy it.",
  };
  const lessonAction: ShareAction = {
    kind: "lesson",
    label: "Copy public lesson link",
    href: lessonHref,
    copied: "Public lesson link copied.",
    failed:
      "Could not copy the public lesson link. Select the address below and copy it.",
  };

  if (workspace.isSample) {
    return (
      <div className="contents">
        <HoverLabel panel="Anyone with the lesson link can open the slides and plan.">
          <span
            tabIndex={0}
            className="inline-flex min-h-9 items-center rounded-[var(--rounded-xs)] border border-[var(--border-control)] bg-[var(--accent-secondary)] px-2.5 text-sm font-semibold text-[var(--on-accent-secondary)] coarse:min-h-11"
          >
            Public
            <span className="sr-only">
              . Anyone with the lesson link can open the slides and plan.
            </span>
          </span>
        </HoverLabel>
        <ShareIconButton action={lessonAction} onNotice={setNotice} />
        {notice ? <AccessNoticeText notice={notice} /> : null}
      </div>
    );
  }

  if (!ready) return null;

  const commit = (next: LessonAccess): void => {
    if (next === access || busy) return;
    setBusy(true);
    setNotice({ tone: "ok", text: "Saving…" });
    void (async () => {
      try {
        await onAccessChange(next);
        if (!alive.current) return;
        setPending(null);
        setNotice(null);
      } catch (error) {
        if (!alive.current) return;
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Could not change the status. Check the connection and try again.",
        });
      } finally {
        if (alive.current) setBusy(false);
      }
    })();
  };

  const requestAccess = (next: LessonAccess): void => {
    if (busy) return;
    if (next === access) {
      setPending(null);
      setNotice(null);
      return;
    }
    setNotice(null);
    if (narrowsAccess(access, next)) {
      setPending(next);
      return;
    }
    setPending(null);
    commit(next);
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
    const key = event.key;
    if (
      key !== "ArrowRight" &&
      key !== "ArrowLeft" &&
      key !== "Home" &&
      key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const currentIndex = ACCESS_ORDER.indexOf(tabAccess);
    const nextIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? ACCESS_ORDER.length - 1
          : key === "ArrowRight"
            ? (currentIndex + 1) % ACCESS_ORDER.length
            : (currentIndex - 1 + ACCESS_ORDER.length) % ACCESS_ORDER.length;
    const next = ACCESS_ORDER[nextIndex] ?? access;
    setTabAccess(next);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-access="${next}"]`)
      ?.focus();
  };

  const shareActions: ShareAction[] =
    access === "public"
      ? [lessonAction, quizAction]
      : access === "private"
        ? [quizAction]
        : [];

  const explanation = accessExplanation(access);
  const showTip = pending === null && notice?.tone !== "error";

  return (
    <div className="contents">
      <p id={explanationId} className="sr-only">
        {explanation}
      </p>
      <HoverLabel panel={showTip ? explanation : ""}>
        <div
          role="group"
          aria-label="Who can open this lesson"
          aria-describedby={explanationId}
          aria-busy={busy}
          className="inline-flex"
          onKeyDown={moveFocus}
        >
          {ACCESS_ORDER.map((value) => {
            const selected = access === value;
            return (
              <button
                key={value}
                type="button"
                data-access={value}
                aria-pressed={selected}
                tabIndex={value === tabAccess ? 0 : -1}
                disabled={busy}
                onClick={() => requestAccess(value)}
                className={segmentClass(selected)}
              >
                {accessLabel(value)}
              </button>
            );
          })}
        </div>
      </HoverLabel>

      {shareActions.length > 0
        ? shareActions.map((action) => (
            <ShareIconButton
              key={action.kind}
              action={action}
              onNotice={setNotice}
            />
          ))
        : null}

      {pending ? (
        <ConfirmAccess
          access={access}
          pending={pending}
          busy={busy}
          onKeep={() => {
            setPending(null);
            setNotice(null);
          }}
          onSwitch={() => commit(pending)}
        />
      ) : null}

      {notice ? <AccessNoticeText notice={notice} /> : null}
    </div>
  );
};
