import { prisma } from "@/lib/prisma";

/** Real provider health — no faked statuses. Checked per dashboard load. */
export async function checkHealth() {
  const started = Date.now();
  let dbOk = false;
  try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch {}
  const dbMs = Date.now() - started;

  let aiOk = false;
  let aiMs = 0;
  if (process.env.AI_API_KEY) {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${process.env.AI_BASE_URL ?? "https://api.openai.com/v1"}/models`, {
        headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      aiOk = res.ok;
      aiMs = Date.now() - t0;
    } catch {}
  }

  const mem = process.memoryUsage();
  return {
    db: { ok: dbOk, latencyMs: dbMs },
    ai: { ok: aiOk, latencyMs: aiMs, configured: Boolean(process.env.AI_API_KEY) },
    server: {
      ok: true,
      uptimeSec: Math.round(process.uptime()),
      env: process.env.NODE_ENV ?? "development",
      heapMb: Math.round(mem.heapUsed / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
  };
}

export const PROVIDERS = [
  { name: "Database", check: "db" },
  { name: "AI Provider", check: "ai" },
  { name: "Server", check: "server" },
];
