"use client";

import { useCallback, useMemo, useState } from "react";
import { Files, Eye, Code2 } from "lucide-react";
import FileExplorer from "@/components/workspace/FileExplorer";
import CodeEditor from "@/components/workspace/CodeEditor";
import PreviewPane from "@/components/workspace/PreviewPane";
import PublishPanel from "./PublishPanel";
type FileMeta = { path: string; isDir: boolean; size: number };

export default function ProjectWorkspace({
  project,
  files,
}: {
  project: { id: string; name: string; framework: string | null; language: string | null };
  files: FileMeta[];
}) {
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"files" | "editor" | "preview">("editor");

  const openFile = useCallback((path: string) => {
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
    setActivePath(path);
    setMobilePane("editor");
  }, []);

  const closeTab = useCallback((path: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path);
      setActivePath((cur) => (cur === path ? next.at(-1) ?? null : cur));
      return next;
    });
  }, []);

  const fileTree = useMemo(() => files.filter((f) => !f.path.includes("/")), [files]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-2 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold">{project.name}</h1>
          {project.framework && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-400">
              {project.framework}
            </span>
          )}
        </div>
        <PublishPanel projectId={project.id} />
        {/* Mobile pane switcher */}
        <div className="flex gap-1 md:hidden">
          {(["files", "editor", "preview"] as const).map((pane) => (
            <button
              key={pane}
              onClick={() => setMobilePane(pane)}
              className={`rounded-lg p-2 ${mobilePane === pane ? "bg-ink-100 dark:bg-ink-800" : ""}`}
              aria-label={pane}
            >
              {pane === "files" ? <Files className="h-4 w-4" /> : pane === "editor" ? <Code2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* Panes */}
      <div className="flex min-h-0 flex-1">
        <div className={`w-56 shrink-0 border-e border-ink-200 dark:border-ink-800 md:block ${mobilePane === "files" ? "block" : "hidden"}`}>
          <FileExplorer projectId={project.id} files={files} onOpen={openFile} />
        </div>

        <div className={`min-w-0 flex-1 flex-col md:flex ${mobilePane === "editor" ? "flex" : "hidden"}`}>
          {openTabs.length > 0 && (
            <div className="flex overflow-x-auto border-b border-ink-200 thin-scroll dark:border-ink-800">
              {openTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActivePath(tab)}
                  className={`flex items-center gap-2 whitespace-nowrap border-e border-ink-200 px-3 py-1.5 text-xs dark:border-ink-800 ${
                    activePath === tab ? "bg-ink-100 font-medium dark:bg-ink-800" : "text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800/50"
                  }`}
                >
                  <span className="max-w-40 truncate">{tab.split("/").pop()}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && closeTab(tab)}
                    className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}
          {activePath ? (
            <CodeEditor projectId={project.id} path={activePath} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-ink-400">
              Select a file to edit
            </div>
          )}
        </div>

        <div className={`w-96 shrink-0 border-s border-ink-200 dark:border-ink-800 md:block ${mobilePane === "preview" ? "block" : "hidden"}`}>
          <PreviewPane projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
