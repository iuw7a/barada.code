"use client";

import { useEffect, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "@codemirror/basic-setup";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";

function languageFor(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["js", "jsx", "mjs", "cjs", "ts", "tsx"].includes(ext)) return javascript({ jsx: true, typescript: ext.startsWith("t") });
  if (["html", "htm", "vue"].includes(ext)) return html();
  if (ext === "css" || ext === "scss") return css();
  if (ext === "json") return json();
  if (["md", "mdx"].includes(ext)) return markdown();
  if (ext === "py") return python();
  return [];
}

export default function CodeEditor({ projectId, path }: { projectId: string; path: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load file content + (re)create the editor when the tab changes.
  useEffect(() => {
    let cancelled = false;
    setDirty(false);
    setError(null);

    async function load() {
      const res = await fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`);
      if (!res.ok || cancelled) {
        if (!cancelled) setError("Could not load file");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      if (data.file.isDir) return;

      const parent = containerRef.current;
      if (!parent) return;

      viewRef.current?.destroy();
      const view = new EditorView({
        state: EditorState.create({
          doc: data.file.content ?? "",
          extensions: [
            basicSetup,
            languageFor(path),
            oneDark,
            EditorView.updateListener.of((u) => {
              if (u.docChanged) setDirty(true);
            }),
          ],
        }),
        parent,
      });
      viewRef.current = view;
    }
    load();
    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [projectId, path]);

  // Ctrl/Cmd+S → save.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, path, dirty]);

  async function save() {
    const view = viewRef.current;
    if (!view || saving) return;
    setSaving(true);
    setError(null);
    try {
      const content = view.state.doc.toString();
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-ink-200 px-3 py-1 text-xs text-ink-400 dark:border-ink-800">
        <span className="font-mono">{path}</span>
        <span>
          {saving ? "Saving…" : dirty ? "Unsaved changes (Ctrl+S)" : savedAt ? `Saved ${savedAt}` : ""}
        </span>
      </div>
      {error && <p className="px-3 py-1 text-xs text-red-500">{error}</p>}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto thin-scroll" />
    </div>
  );
}
