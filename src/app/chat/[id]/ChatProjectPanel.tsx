"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Eye, Code2, Files } from "lucide-react";
import FileExplorer from "@/components/workspace/FileExplorer";
import CodeEditor from "@/components/workspace/CodeEditor";
import PreviewPane from "@/components/workspace/PreviewPane";

type FileMeta = { path: string; isDir: boolean; size: number };
type Tab = "preview" | "code" | "files";

/**
 * Project panel for the chat split view — Replit-style top toolbar:
 * Preview / Code / Files as tabs, full-height content underneath.
 */
export default function ChatProjectPanel({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [name, setName] = useState<string>("Project");
  const [tab, setTab] = useState<Tab>("preview");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);

  const load = useCallback(async () => {
    try {
      const [projRes, filesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/files`),
      ]);
      if (projRes.ok) {
        const data = await projRes.json();
        if (data.project?.name) setName(data.project.name);
      }
      if (filesRes.ok) {
        const data = await filesRes.json();
        const list: FileMeta[] = data.files ?? [];
        setFiles(list);
        setPreviewNonce((n) => n + 1);
        return list;
      }
    } catch {
      /* keep previous state */
    }
    return [];
  }, [projectId]);

  useEffect(() => {
    void load().then((list) => {
      // Auto-open the entry file once.
      setOpenTabs((tabs) => {
        if (tabs.length > 0) return tabs;
        const entry =
          list.find((f) => f.path === "index.html") ??
          list.find((f) => f.path === "preview.html") ??
          list.find((f) => !f.isDir && f.path.endsWith(".html"));
        if (entry) {
          setActivePath(entry.path);
          return [entry.path];
        }
        return tabs;
      });
    });
  }, [load]);

  const openFile = useCallback((path: string) => {
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
    setActivePath(path);
    setTab("code");
  }, []);

  const closeTab = useCallback((path: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path);
      setActivePath((cur) => (cur === path ? next.at(-1) ?? null : cur));
      return next;
    });
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-3 py-1.5 dark:border-ink-800">
        <span className="max-w-40 truncate text-sm font-semibold">{name}</span>
        <div className="flex items-center gap-1">
          {(
            [
              ["preview", "Preview", Eye],
              ["code", "Code", Code2],
              ["files", "Files", Files],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                tab === key
                  ? "bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100"
                  : "text-ink-500 hover:bg-ink-50 dark:text-ink-400 dark:hover:bg-ink-800/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
          <button
            onClick={() => {
              void load();
              setPreviewNonce((n) => n + 1);
            }}
            className="btn-ghost p-1.5"
            title="Refresh"
            aria-label="Refresh files and preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === "preview" && (
        <div className="min-h-0 flex-1">
          <PreviewPane key={previewNonce} projectId={projectId} />
        </div>
      )}

      {tab === "code" && (
        <div className="flex min-h-0 flex-1 flex-col">
          {openTabs.length > 0 && (
            <div className="flex overflow-x-auto border-b border-ink-200 thin-scroll dark:border-ink-800">
              {openTabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setActivePath(t)}
                  className={`flex items-center gap-2 whitespace-nowrap border-e border-ink-200 px-3 py-1.5 text-xs dark:border-ink-800 ${
                    activePath === t
                      ? "bg-ink-100 font-medium dark:bg-ink-800"
                      : "text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800/50"
                  }`}
                >
                  <span className="max-w-40 truncate">{t.split("/").pop()}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(t);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && closeTab(t)}
                    className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}
          {activePath ? (
            <CodeEditor projectId={projectId} path={activePath} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-400">
              Open a file from the Files tab
            </div>
          )}
        </div>
      )}

      {tab === "files" && (
        <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
          <FileExplorer projectId={projectId} files={files} onOpen={openFile} />
        </div>
      )}
    </div>
  );
}
