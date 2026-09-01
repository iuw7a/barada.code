"use client";

import { useMemo, useState } from "react";
import { File as FileIcon, Folder, FolderOpen, Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";

type FileMeta = { path: string; isDir: boolean; size: number };

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
};

function buildTree(files: FileMeta[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };
  for (const f of files) {
    const segments = f.path.split("/");
    let node = root;
    segments.forEach((seg, i) => {
      const isLast = i === segments.length - 1;
      const path = segments.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === seg && c.isDir === (isLast ? f.isDir : true));
      if (!child) {
        child = { name: seg, path, isDir: isLast ? f.isDir : true, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    nodes.forEach((n) => sort(n.children));
    return nodes;
  };
  return sort(root.children);
}

export default function FileExplorer({
  projectId,
  files,
  onOpen,
}: {
  projectId: string;
  files: FileMeta[];
  onOpen: (path: string) => void;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggleDir(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function api(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/files`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      window.location.reload(); // simple + correct: server re-renders the tree
    } finally {
      setBusy(false);
    }
  }

  function newNode(dirPath: string, isDir: boolean) {
    const name = window.prompt(isDir ? "New folder name" : "New file name (e.g. src/App.tsx)");
    if (!name) return;
    const path = dirPath ? `${dirPath}/${name}` : name;
    api("/files", "POST", isDir ? { path: path + "/" } : { path, content: "" });
  }

  function deleteNode(path: string) {
    if (!window.confirm(`Delete ${path}?`)) return;
    api("/files", "DELETE", { path });
  }

  function renderNodes(nodes: TreeNode[], depth: number): React.ReactNode {
    return nodes.map((node) => {
      const isOpen = expanded.has(node.path);
      return (
        <div key={node.path}>
          <div
            className={`group flex items-center gap-1 px-2 py-1 text-sm hover:bg-ink-100 dark:hover:bg-ink-800 ${
              depth * 3 > 0 ? "" : ""
            }`}
            style={{ paddingInlineStart: `${8 + depth * 12}px` }}
          >
            <button
              onClick={() => (node.isDir ? toggleDir(node.path) : onOpen(node.path))}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
            >
              {node.isDir ? (
                <>
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />}
                  {isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-accent-600" /> : <Folder className="h-4 w-4 shrink-0 text-accent-600" />}
                </>
              ) : (
                <FileIcon className="h-4 w-4 shrink-0 text-ink-400" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            <span className="hidden shrink-0 gap-1 group-hover:flex">
              {node.isDir && (
                <>
                  <button onClick={() => newNode(node.path, false)} className="p-0.5 text-ink-400 hover:text-ink-700" aria-label="New file">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => newNode(node.path, true)} className="p-0.5 text-ink-400 hover:text-ink-700" aria-label="New folder">
                    <Folder className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button onClick={() => deleteNode(node.path)} className="p-0.5 text-ink-400 hover:text-red-500" aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          {node.isDir && isOpen && renderNodes(node.children, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2 dark:border-ink-800">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-400">Files</span>
        <button onClick={() => newNode("", false)} disabled={busy} className="p-1 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200" aria-label="New file">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1 thin-scroll">
        {tree.length === 0 ? (
          <p className="px-3 py-4 text-xs text-ink-400">No files yet — the AI will create them, or add one with +.</p>
        ) : (
          renderNodes(tree, 0)
        )}
      </div>
    </div>
  );
}
