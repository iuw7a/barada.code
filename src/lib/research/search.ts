/**
 * Web search, image search and documentation research for the agent.
 *
 * Providers are Plausible-style Serper-compatible APIs configured purely via
 * environment variables — keys never touch source, logs, or the client:
 *   WEB_SEARCH_API_KEY   (required for search) → https://google.serper.dev
 *   IMAGE_SEARCH_API_KEY (required for images)
 * Both fall back gracefully: if a key is missing the tool reports "not
 * configured" instead of failing the agent run.
 */

const SEARCH_URL = process.env.WEB_SEARCH_API_URL ?? "https://google.serper.dev/search";
const IMAGES_URL = process.env.IMAGE_SEARCH_API_URL ?? "https://google.serper.dev/images";

export type WebResult = { title: string; url: string; snippet: string };
export type ImageResult = { title: string; imageUrl: string; pageUrl: string; source: string };

export function webSearchConfigured(): boolean {
  return Boolean(process.env.WEB_SEARCH_API_KEY);
}
export function imageSearchConfigured(): boolean {
  return Boolean(process.env.IMAGE_SEARCH_API_KEY);
}

export async function webSearch(query: string, num = 6): Promise<WebResult[]> {
  const key = process.env.WEB_SEARCH_API_KEY;
  if (!key) throw new Error("WEB_SEARCH_API_KEY is not configured");

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: Math.min(num, 10) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`web search error ${res.status}`);
  const data = (await res.json()) as {
    organic?: Array<{ title: string; link: string; snippet?: string }>;
    answerBox?: { title?: string; snippet?: string; link?: string };
  };

  const out: WebResult[] = [];
  if (data.answerBox?.snippet) {
    out.push({
      title: data.answerBox.title ?? "Answer",
      url: data.answerBox.link ?? "",
      snippet: data.answerBox.snippet,
    });
  }
  for (const r of data.organic ?? []) {
    out.push({ title: r.title, url: r.link, snippet: r.snippet ?? "" });
  }
  return out.slice(0, num);
}

export async function imageSearch(query: string, num = 6): Promise<ImageResult[]> {
  const key = process.env.IMAGE_SEARCH_API_KEY;
  if (!key) throw new Error("IMAGE_SEARCH_API_KEY is not configured");

  const res = await fetch(IMAGES_URL, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: Math.min(num, 10) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`image search error ${res.status}`);
  const data = (await res.json()) as {
    images?: Array<{ title: string; imageUrl: string; link: string; source?: string }>;
  };
  return (data.images ?? []).slice(0, num).map((i) => ({
    title: i.title,
    imageUrl: i.imageUrl,
    pageUrl: i.link,
    source: i.source ?? "web",
  }));
}

/** Official-docs-first research: scopes the query to authoritative sources. */
export async function docsSearch(query: string): Promise<WebResult[]> {
  const official = [
    "site:nextjs.org", "site:react.dev", "site:nodejs.org", "site:pris.ly",
    "site:postgresql.org", "site:vitejs.dev", "site:developer.mozilla.org",
  ];
  const q = `${query} (${official.join(" OR ")})`;
  const results = await webSearch(q, 8);
  // Return both official hits and general results as fallback context.
  if (results.length >= 3) return results.slice(0, 8);
  return webSearch(query, 6);
}
