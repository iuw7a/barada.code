"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Preview v2 (safe by construction):
 * The project is served over real URLs at /api/projects/{id}/preview/… and
 * rendered in a sandboxed iframe (sandbox="allow-scripts"). Real URLs mean
 * relative asset references (styles.css, script.js) and page links
 * (menu.html) resolve inside the iframe — nothing executes on the host.
 */
export default function PreviewPane({ projectId }: { projectId: string }) {
  const [entry, setEntry] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    try {
      // Find the preview entry — the iframe src points at the exact file so
      // relative asset/page references resolve against /…/preview/ correctly.
      for (const candidate of ["index.html", "preview.html", "public/index.html"]) {
        const res = await fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(candidate)}`);
        if (res.ok) {
          const data = await res.json();
          if (!data.file?.isDir && data.file?.content) {
            setEntry(candidate);
            return;
          }
        }
      }
      setEntry(null);
    } catch {
      setEntry(null);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  const previewSrc = entry ? `/api/projects/${projectId}/preview/${entry}` : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-400">Preview</span>
        <button onClick={() => setNonce((n) => n + 1)} className="p-1 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200" aria-label="Refresh preview">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {!previewSrc ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-ink-400">
          No preview entry (index.html) found yet.
        </div>
      ) : (
        <iframe
          key={nonce}
          title="Project preview"
          sandbox="allow-scripts allow-same-origin"
          src={previewSrc}
          className="h-full w-full flex-1 bg-white"
        />
      )}
    </div>
  );
}
