"use client";

import { Button, Card, Notice, fieldClass } from "@oku/ui";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";

interface AdminGateProps {
  children: ReactNode;
}

export const AdminGate = ({ children }: AdminGateProps): ReactElement => {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const probe = async (): Promise<void> => {
      const response = await fetch("/api/admin/books");
      setAuthed(response.ok);
      setReady(true);
    };
    void probe();
  }, []);

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      setError("Invalid admin token");
      return;
    }
    setAuthed(true);
  };

  if (!ready) {
    return (
      <p role="status" className="text-[var(--text-secondary)]">
        Checking access…
      </p>
    );
  }

  if (!authed) {
    return (
      <Card className="max-w-md">
        <h2 className="mb-2 text-lg font-semibold">Admin access</h2>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Enter the Phase 1 ADMIN_TOKEN to manage textbook ingestion.
        </p>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
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
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button type="submit">Continue</Button>
        </form>
      </Card>
    );
  }

  return <>{children}</>;
};
