"use client";

import { useState } from "react";
import { Database, Globe, CheckCircle2, XCircle } from "lucide-react";

type Integration = { provider: string; status: string; meta: Record<string, string> };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DATA: Database,
};

const LABELS: Record<string, string> = {
  DATA: "External Database",
};

const DESCRIPTIONS: Record<string, string> = {
  DATA:
    "Connect your own PostgreSQL/MySQL database for generated projects. The connection string is stored encrypted and injected into your project's sandbox as DATABASE_URL at run time — never into your source code.",
};

export default function IntegrationsClient({ integrations }: { integrations: Integration[] }) {
  const [items, setItems] = useState(integrations);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(provider: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, credential }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Connect failed");
      }
      setItems((prev) => prev.map((i) => (i.provider === provider ? { ...i, status: "CONNECTED" } : i)));
      setConnecting(null);
      setCredential("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(provider: string) {
    setBusy(true);
    try {
      await fetch("/api/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      setItems((prev) => prev.map((i) => (i.provider === provider ? { ...i, status: "DISCONNECTED" } : i)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Integrations</h1>
      <p className="mb-8 text-sm text-ink-500">
        Only genuinely implemented integrations are shown. Credentials are encrypted at rest and never displayed again.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((integration) => {
          const Icon = ICONS[integration.provider] ?? Globe;
          const connected = integration.status === "CONNECTED";
          return (
            <div key={integration.provider} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-ink-700 dark:text-ink-300" />
                  <h2 className="font-medium">{LABELS[integration.provider]}</h2>
                </div>
                {connected ? (
                  <span className="flex items-center gap-1 text-xs text-accent-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-ink-400">
                    <XCircle className="h-3.5 w-3.5" /> Not connected
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">{DESCRIPTIONS[integration.provider]}</p>

              {connecting === integration.provider ? (
                <div className="mt-4 flex flex-col gap-2">
                  <input
                    type="password"
                    className="input"
                    placeholder="postgresql://user:pass@host:5432/db"
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    autoFocus
                  />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => connect(integration.provider)} disabled={busy || !credential} className="btn-primary text-xs">
                      Save
                    </button>
                    <button onClick={() => setConnecting(null)} className="btn-ghost text-xs">Cancel</button>
                  </div>
                </div>
              ) : connected ? (
                <button onClick={() => disconnect(integration.provider)} disabled={busy} className="btn-ghost mt-4 text-xs">
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => {
                    setConnecting(integration.provider);
                    setCredential("");
                    setError(null);
                  }}
                  className="btn-primary mt-4 text-xs"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
