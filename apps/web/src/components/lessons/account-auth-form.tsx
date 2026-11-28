"use client";

import { Button, fieldClass } from "@oku/ui";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";

export interface AuthUser {
  id: string;
  role: "teacher" | "student";
  displayName: string;
  username: string;
}

interface AccountAuthFormProps {
  role: "teacher" | "student";
  title: string;
  subtitle: string;
  onAuthenticated: (user: AuthUser) => void;
}

export const AccountAuthForm = ({
  role,
  title,
  subtitle,
  onAuthenticated,
}: AccountAuthFormProps): ReactElement => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { username, password }
          : { role, username, displayName, password };
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Could not sign in");
        return;
      }
      if (data.user.role !== role) {
        setError(`This account is a ${data.user.role}. Use a ${role} account.`);
        await fetch("/api/auth/logout", { method: "POST" });
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="auth-heading"
      className="rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8"
    >
      <h1 id="auth-heading" className="text-2xl font-bold tracking-[-0.02em]">
        {title}
      </h1>
      <p className="mt-2 max-w-[58ch] text-sm leading-6 text-[var(--text-secondary)]">
        {subtitle}
      </p>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-[var(--rounded-xs)] border px-3 py-1.5 text-sm font-semibold ${
            mode === "login"
              ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
              : "border-[var(--border-hairline)]"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`rounded-[var(--rounded-xs)] border px-3 py-1.5 text-sm font-semibold ${
            mode === "register"
              ? "border-transparent bg-[var(--accent-secondary)] text-[var(--on-accent-secondary)]"
              : "border-[var(--border-hairline)]"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={(event) => void submit(event)} className="mt-5 max-w-md space-y-4">
        {mode === "register" ? (
          <div>
            <label htmlFor="auth-display-name" className="block text-sm font-semibold">
              Display name
            </label>
            <input
              id="auth-display-name"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={`${fieldClass} mt-1.5`}
            />
          </div>
        ) : null}
        <div>
          <label htmlFor="auth-username" className="block text-sm font-semibold">
            Username
          </label>
          <input
            id="auth-username"
            required
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={`${fieldClass} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="block text-sm font-semibold">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${fieldClass} mt-1.5`}
          />
        </div>
        {error ? (
          <p className="text-sm font-medium text-[var(--status-failed)]">{error}</p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </section>
  );
};
