"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ExternalLink, Play, Square, Monitor, Tablet, Smartphone, Loader2 } from "lucide-react";

type ProcState = {
  processes: Array<{ id: string; status: string; port: number | null; command: string; tail: string }>;
};

/**
 * Live Browser panel — shows the ACTUAL running dev server through the
 * authenticated /live proxy. Server state (Starting/Running/Stopped) comes
 * from /processes. Includes restart + device-size switching.
 */
export default function LivePreview({ projectId }: { projectId: string }) {
  const [iframeNonce, setIframeNonce] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [serverState, setServerState] = useState<"STOPPED" | "RUNNING" | "STARTING">("STOPPED");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => setIframeNonce((n) => n + 1), []);

  const pollProcesses = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/processes`);
      if (!res.ok) return;
      const data: ProcState = await res.json();
      const running = data.processes.some((p) => p.status === "RUNNING" && p.port);
      setServerState(running ? "RUNNING" : "STOPPED");
    } catch {
      /* keep last state */
    }
  }, [projectId]);

  useEffect(() => {
    void pollProcesses();
    pollRef.current = setInterval(pollProcesses, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollProcesses]);

  async function startServer() {
    setStarting(true);
    setError(null);
    setServerState("STARTING");
    try {
      // Detect the run script from package.json via a tiny terminal exec.
      const detect = await fetch(`/api/projects/${projectId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "node -p \"(()=>{try{const s=require('./package.json').scripts||{};return s.dev?'npm run dev':s.start?'npm start':''}catch{return ''}})()\"",
          timeoutSec: 15,
        }),
      });
      const cmd = detect.ok ? ((await detect.json()).stdout ?? "").trim() : "";
      const command = cmd || "npx serve -l $PORT .";
      const res = await fetch(`/api/projects/${projectId}/processes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, name: "dev" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not start server");
      }
      // Give the server a moment, then refresh the iframe.
      setTimeout(() => {
        setServerState("RUNNING");
        refresh();
      }, 4000);
    } catch (e) {
      setServerState("STOPPED");
      setError(e instanceof Error ? e.message : "start failed");
    } finally {
      setStarting(false);
    }
  }

  async function stopServer() {
    try {
      const res = await fetch(`/api/projects/${projectId}/processes`);
      const data: ProcState = await res.json();
      for (const p of data.processes.filter((x) => x.status === "RUNNING")) {
        await fetch(`/api/projects/${projectId}/processes`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processId: p.id }),
        });
      }
      setServerState("STOPPED");
    } catch {
      /* best effort */
    }
  }

  const deviceWidth = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "390px";
  const running = serverState === "RUNNING";

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              running
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : serverState === "STARTING"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400"
            }`}
          >
            {serverState === "RUNNING" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
            {serverState === "RUNNING" ? "Running" : serverState === "STARTING" ? "Starting…" : "Server stopped"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["desktop", "tablet", "mobile"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`rounded-md p-1.5 ${device === d ? "bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100" : "text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"}`}
              title={d}
              aria-label={d}
            >
              {d === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : d === "tablet" ? <Tablet className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-ink-200 dark:bg-ink-700" />
          {!running ? (
            <button onClick={startServer} disabled={starting} className="btn-ghost p-1.5" title="Start dev server" aria-label="Start server">
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <button onClick={stopServer} className="btn-ghost p-1.5" title="Stop server" aria-label="Stop server">
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={refresh} className="btn-ghost p-1.5" title="Refresh" aria-label="Refresh preview">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <a
            href={`/api/projects/${projectId}/live/`}
            target="_blank"
            rel="noreferrer"
            className={`btn-ghost p-1.5 ${!running ? "pointer-events-none opacity-40" : ""}`}
            title="Open in new tab"
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Frame */}
      <div className="min-h-0 flex-1 overflow-auto bg-ink-50 p-2 dark:bg-ink-950">
        {running ? (
          <div className="mx-auto h-full bg-white shadow-sm dark:bg-white" style={{ width: deviceWidth, maxWidth: "100%" }}>
            <iframe
              key={iframeNonce}
              title="Live preview"
              src={`/api/projects/${projectId}/live/`}
              className="h-full min-h-[420px] w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-medium">No server running</p>
            <p className="max-w-xs text-xs text-ink-400">
              Start the dev server to see your application live here. Barada starts it automatically during builds.
            </p>
            <button onClick={startServer} disabled={starting} className="btn-primary text-xs">
              {starting ? "Starting…" : "Start server"}
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
