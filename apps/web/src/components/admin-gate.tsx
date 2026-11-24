"use client";

import { Button, Card, Notice, fieldClass } from "@oku/ui";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { NETWORK_MESSAGE, failureText, isTimeout } from "@/lib/admin-request";
import type { LibrarySession } from "@/lib/library-session";
import { loadLibrarySession } from "@/lib/library-session";

interface AdminGateProbeProps {
  /** Other admin pages: the books request only answers whether access is open. */
  withCatalog?: false;
  children: ReactNode;
}

interface AdminGateCatalogProps {
  /**
   * Library index: keep that books response, and start the model request in
   * the same tick. A denied check drops the model result.
   */
  withCatalog: true;
  children: (session: LibrarySession) => ReactNode;
}

type AdminGateProps = AdminGateProbeProps | AdminGateCatalogProps;

type GatePhase = "checking" | "prompt" | "error" | "open";

const PROBE_ERROR = "Access could not be checked. Try again.";

export const AdminGate = (props: AdminGateProps): ReactElement => {
  const withCatalog = props.withCatalog === true;
  const [phase, setPhase] = useState<GatePhase>("checking");
  const [problem, setProblem] = useState(PROBE_ERROR);
  const [session, setSession] = useState<LibrarySession | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const check = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setPhase("checking");
    if (withCatalog) {
      const boot = await loadLibrarySession(signal);
      if (signal?.aborted) return;
      if (boot.status === "denied") {
        setPhase("prompt");
        return;
      }
      if (boot.status === "failed") {
        setProblem(boot.timedOut ? PROBE_ERROR : NETWORK_MESSAGE);
        setPhase("error");
        return;
      }
      setSession(boot.session);
      setPhase("open");
      return;
    }

    try {
      const response = await fetch("/api/admin/books", {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(20_000)])
          : AbortSignal.timeout(20_000),
      });
      if (response.status === 401) {
        setPhase("prompt");
        return;
      }
      if (!response.ok) {
        setProblem(PROBE_ERROR);
        setPhase("error");
        return;
      }
      setPhase("open");
    } catch (caught) {
      if (signal?.aborted) return;
      setProblem(isTimeout(caught) ? PROBE_ERROR : NETWORK_MESSAGE);
      setPhase("error");
    }
  }, [withCatalog]);

  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    return () => controller.abort();
  }, [check]);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 401) {
        setError("Invalid admin token");
        return;
      }
      if (!response.ok) {
        setError(
          failureText(response.status, "Sign-in could not be completed. Try again."),
        );
        return;
      }
      if (withCatalog) {
        const boot = await loadLibrarySession();
        if (boot.status === "denied") {
          setError("Invalid admin token");
          return;
        }
        if (boot.status === "failed") {
          setError(
            boot.timedOut
              ? "Sign-in took too long. Try again."
              : NETWORK_MESSAGE,
          );
          return;
        }
        setSession(boot.session);
      }
      setPhase("open");
    } catch (caught) {
      setError(
        isTimeout(caught) ? "Sign-in took too long. Try again." : NETWORK_MESSAGE,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "checking") {
    return (
      <p role="status" className="text-[var(--text-secondary)]">
        Checking access…
      </p>
    );
  }

  if (phase === "error") {
    return (
      <Card className="max-w-md">
        <h2 className="mb-2 text-lg font-semibold">Admin access</h2>
        <Notice tone="error">{problem}</Notice>
        <Button className="mt-4" onClick={() => void check()}>
          Try again
        </Button>
      </Card>
    );
  }

  if (phase === "prompt") {
    return (
      <Card className="max-w-md">
        <h2 className="mb-2 text-lg font-semibold">Admin access</h2>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Enter the Phase 1 ADMIN_TOKEN to manage textbook ingestion.
        </p>
        <form className="flex flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
          <label htmlFor="admin-token" className="text-sm font-medium">
            Admin token
          </label>
          <input
            id="admin-token"
            className={fieldClass}
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Checking…" : "Continue"}
          </Button>
        </form>
      </Card>
    );
  }

  if (props.withCatalog) {
    return <>{session ? props.children(session) : null}</>;
  }

  return <>{props.children}</>;
};
