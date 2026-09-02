"use client";

import { useCallback, useEffect, useState } from "react";
import { FilePlus2, FilePen, FileX2, FolderInput, GitCompare } from "lucide-react";

type Change = {
  id: string;
  path: string;
  kind: "created" | "modified" | "deleted" | "renamed";
  fromPath: string | null;
  agentRun: string | null;
  createdAt: string;
};

const KIND_META: Record<Change["kind"], { icon: typeof FilePlus2; className: string; label: string }> = {
  created: { icon: FilePlus2, className: "text-emerald-500", label: "New" },
  modified: { icon: FilePen, className: "text-amber-500", label: "Modified" },
  deleted: { icon: FileX2, className: "text-red-500", label: "Deleted" },
  renamed: { icon: FolderInput, className: "text-sky-500", label: "Renamed" },
};

/** Changed Files — per-build file activity feed. Click to open in the editor. */
export default function ChangedFiles({ projectId, onOpen }: { projectId: string; onOpen?: (path: string) => void }) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/changes`);
      if (res.ok) {
        const data = await res.json();
        setChanges(data.changes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Group by build run (agentRun), newest first.
  const groups = new Map<string, Change[]>();
  for (const c of changes) {
    const key = c.agentRun ?? "manual";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
          <GitCompare className="h-3 w-3" /> Changed Files
        </span>
        <button onClick={load} className="text-[11px] text-ink-400 hover:text-ink-600 dark:hover:text-ink-300">
          Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
        {loading && <p className="p-2 text-xs text-ink-400">Loading…</p>}
        {!loading && changes.length === 0 && (
          <p className="p-2 text-xs text-ink-400">No changes yet — they appear here as Barada builds.</p>
        )}
        {[...groups.entries()].slice(0, 10).map(([run, items]) => (
          <div key={run} className="mb-3">
            <p className="mb-1 px-1 text-[10px] uppercase tracking-wide text-ink-400">
              {run === "manual" ? "Manual edits" : `Build ${run.slice(0, 8)}`} · {new Date(items[0].createdAt).toLocaleTimeString()}
            </p>
            <div className="space-y-0.5">
              {items.map((c) => {
                const meta = KIND_META[c.kind];
                const Icon = meta.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => c.kind !== "deleted" && onOpen?.(c.path)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-start text-xs hover:bg-ink-100 dark:hover:bg-ink-800/60"
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.className}`} />
                    <span className="min-w-0 flex-1 truncate font-mono">{c.path}</span>
                    <span className={`shrink-0 text-[10px] ${meta.className}`}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
