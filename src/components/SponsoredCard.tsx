"use client";

import { useEffect, useState } from "react";

type Ad = {
  id: string; title: string; description: string | null;
  imageUrl: string | null; videoUrl: string | null; ctaText: string | null; ctaUrl: string | null; advertiser: string;
};

/**
 * Clearly-labeled sponsored card shown beneath the conversation.
 * Never styled like an AI reply; impression + click tracked server-side.
 */
export default function SponsoredCard() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sessionKey = "barada_ads_shown";
    const shown = parseInt(sessionStorage.getItem(sessionKey) ?? "0", 10);
    fetch("/api/ads")
      .then(async (r) => (r.status === 204 ? null : r.json()))
      .then((d) => { if (d?.ad && shown < 10) setAd(d.ad); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ad) sessionStorage.setItem("barada_ads_shown", String((parseInt(sessionStorage.getItem("barada_ads_shown") ?? "0", 10) || 0) + 1));
  }, [ad]);

  if (!ad || dismissed) return null;

  return (
    <aside className="mx-auto mt-4 w-full max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-white/8 bg-white/[0.02] opacity-90 transition-opacity hover:opacity-100">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Sponsored</span>
        <button onClick={() => setDismissed(true)} className="text-[11px] text-zinc-700 hover:text-zinc-500" aria-label="Dismiss ad">✕</button>
      </div>
      <a href={`/api/ads/click?id=${ad.id}`} target="_blank" rel="noopener noreferrer sponsored" className="block p-3">
        <div className="flex gap-3">
          {ad.imageUrl && <img src={ad.imageUrl} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />}
          {ad.videoUrl && !ad.imageUrl && (
            <video src={ad.videoUrl} className="h-16 w-24 shrink-0 rounded-lg object-cover" muted autoPlay loop playsInline />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-zinc-300">{ad.title}</p>
            {ad.description && <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-500">{ad.description}</p>}
            <p className="mt-1 text-[10px] text-zinc-700">by {ad.advertiser}</p>
          </div>
          {ad.ctaText && (
            <span className="ml-auto hidden shrink-0 self-center rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-400/90 ring-1 ring-emerald-500/20 sm:block">
              {ad.ctaText} ↗
            </span>
          )}
        </div>
      </a>
    </aside>
  );
}
