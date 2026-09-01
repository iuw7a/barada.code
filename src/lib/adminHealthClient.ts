/** Shape mirror of /api/admin/health for client components. */
export async function checkHealth() {
  const res = await fetch("/api/admin/health");
  if (!res.ok) throw new Error("health unavailable");
  return res.json() as Promise<{
    db: { ok: boolean; latencyMs: number };
    ai: { ok: boolean; latencyMs: number; configured: boolean };
    server: { ok: boolean; uptimeSec: number; env: string; heapMb: number; rssMb: number };
  }>;
}
