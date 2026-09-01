"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPage() {
  const [stage, setStage] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessage("If that email exists, a reset link is on its way.");
      if (data.devToken) {
        setToken(data.devToken);
        setStage("confirm");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setMessage("Password updated. You can sign in now.");
      setStage("request");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-6 text-center text-xl font-semibold">Reset your password</h1>
        {message && <p className="mb-4 text-sm text-accent-700 dark:text-accent-400">{message}</p>}
        {stage === "request" ? (
          <form onSubmit={requestReset} className="flex flex-col gap-4">
            <input
              type="email"
              required
              placeholder="Email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary">Send reset link</button>
          </form>
        ) : (
          <form onSubmit={confirmReset} className="flex flex-col gap-4">
            <input
              type="text"
              required
              placeholder="Reset token"
              className="input font-mono text-xs"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="New password (8+ characters)"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary">Set new password</button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-ink-500">
          <Link href="/signin" className="font-medium text-accent-600 hover:text-accent-700">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
