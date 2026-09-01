"use client";

import { useState } from "react";

export function KeyRow({ provider, masked, env, usage, ok }: { provider: string; masked: string | null; env: string; usage: string; ok: boolean }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function test() {
    setTesting(true); setResult(null);
    try {
      const res = await fetch("/api/admin/api-keys/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ env }),
      });
      const d = await res.json();
      setResult(res.ok && d.ok ? "✓ connected" : `✗ ${d.error ?? "failed"}`);
    } catch { setResult("✗ request failed"); }
    finally { setTesting(false); }
  }

  return (
    <tr className="border-b border-white/[0.04] last:border-0">
      <td className="p-3.5 font-medium text-zinc-200">{provider}</td>
      <td className="p-3.5 font-mono text-[12px] text-zinc-400">{masked ?? "— not set —"}</td>
      <td className="p-3.5 font-mono text-[11px] text-zinc-600">{env}</td>
      <td className="p-3.5 text-zinc-500">{usage}</td>
      <td className="p-3.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-300"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
          {ok ? "Configured" : "Missing"}
        </span>
      </td>
      <td className="p-3.5">
        <button onClick={test} disabled={!ok || testing} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-30">
          {testing ? "Testing…" : "Test"}
        </button>
        {result && <span className={`ml-2 text-[11px] ${result.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{result}</span>}
      </td>
    </tr>
  );
}
