"use client";

import { useState } from "react";
import { Upload, FileText, Image as ImageIcon, FileCode, Trash2 } from "lucide-react";

type Asset = { id: string; name: string; kind: string; size: number; createdAt: Date };

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  IMAGE: ImageIcon,
  TEMPLATE: FileCode,
  COMPONENT: FileCode,
  DOC: FileText,
  OTHER: FileText,
};

function fmtSize(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export default function LibraryClient({ assets }: { assets: Asset[] }) {
  const [items, setItems] = useState(assets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const kind = file.type.startsWith("image/") ? "IMAGE" : file.name.endsWith(".md") ? "DOC" : "OTHER";
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, kind, dataBase64 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }
      // Refresh server data.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this asset?")) return;
    await fetch("/api/library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: id }),
    });
    setItems((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Library</h1>
        <label className="btn-primary cursor-pointer">
          <Upload className="h-4 w-4" />
          {busy ? "Uploading…" : "Upload"}
          <input type="file" className="hidden" onChange={upload} disabled={busy} />
        </label>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-16 text-center">
          <Upload className="mb-4 h-10 w-10 text-ink-300" />
          <h2 className="text-lg font-medium">Your library is empty</h2>
          <p className="mt-1 max-w-sm text-sm text-ink-500">
            Upload assets, templates and reusable components here — the AI can reference them in projects.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((asset) => {
            const Icon = KIND_ICONS[asset.kind] ?? FileText;
            return (
              <div key={asset.id} className="card flex items-center gap-3 p-4">
                <Icon className="h-8 w-8 shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{asset.name}</p>
                  <p className="text-xs text-ink-400">{asset.kind} · {fmtSize(asset.size)}</p>
                </div>
                <button onClick={() => remove(asset.id)} className="p-1 text-ink-400 hover:text-red-500" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
