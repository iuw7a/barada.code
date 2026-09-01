import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Barada AI — Get the App",
  description: "Download the Barada AI mobile app for Android and iOS.",
};

/** Tracked store links — clicks are recorded server-side and visible in /admin/app. */
const GOOGLE_PLAY = "/api/app/click?store=google";
const APP_STORE = "/api/app/click?store=apple";

export default function AppDownloadPage() {
  return (
    <main className="min-h-dvh bg-[#060a09] text-zinc-100">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(900px 450px at 50% -10%, rgba(16,185,129,0.14), transparent 60%), radial-gradient(700px 400px at 100% 100%, rgba(5,150,105,0.08), transparent 60%)",
        }}
      />
      <div className="relative mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        {/* logo */}
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-3xl font-black text-white shadow-[0_0_60px_rgba(16,185,129,0.35)]">
          B
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
          Barada <span className="text-emerald-400">AI</span>
        </h1>
        <p className="mt-3 max-w-md text-balance text-zinc-400">
          Dein AI-Software-Agent für unterwegs. Chate, baue und veröffentliche
          echte Apps — direkt vom Handy.
        </p>

        {/* store buttons */}
        <div className="mt-10 grid w-full max-w-sm gap-4">
          <a
            href={GOOGLE_PLAY}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/[0.08] hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]"
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0" aria-hidden>
              <path fill="#34A853" d="M3.6 1.8 13.7 12 3.6 22.2c-.4-.3-.6-.8-.6-1.4V3.2c0-.6.2-1.1.6-1.4Z" />
              <path fill="#FBBC04" d="m17.4 8.3-3.7 3.7L3.6 1.8c.2-.2.5-.3.8-.3.3 0 .6.1.9.2l12.1 6.6Z" />
              <path fill="#EA4335" d="M17.4 15.7 5.3 22.3c-.3.2-.6.2-.9.2-.3 0-.6-.1-.8-.3L13.7 12l3.7 3.7Z" />
              <path fill="#4285F4" d="m21.3 10.6-3.9-2.3-4 3.7 4 3.7 3.9-2.3c1.1-.6 1.1-2.2 0-2.8Z" />
            </svg>
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-zinc-500">Jetzt bei</span>
              <span className="block text-lg font-bold text-zinc-100 group-hover:text-emerald-300">Google Play</span>
            </span>
            <span className="ml-auto text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-emerald-400">→</span>
          </a>

          <a
            href={APP_STORE}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/[0.08] hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]"
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0 fill-white" aria-hidden>
              <path d="M17.05 12.54c-.03-2.89 2.36-4.28 2.47-4.35-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.5.96 1.39 2.1 2.95 3.6 2.9 1.44-.06 1.99-.93 3.73-.93s2.23.93 3.76.9c1.55-.03 2.53-1.41 3.48-2.81 1.09-1.61 1.54-3.17 1.57-3.25-.03-.02-3-1.15-3.02-4.6ZM14.16 4.06c.79-.96 1.33-2.3 1.18-3.63-1.14.05-2.53.76-3.35 1.72-.73.85-1.38 2.21-1.21 3.51 1.28.1 2.58-.65 3.38-1.6Z" />
            </svg>
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-zinc-500">Laden im</span>
              <span className="block text-lg font-bold text-zinc-100 group-hover:text-emerald-300">App Store</span>
            </span>
            <span className="ml-auto text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-emerald-400">→</span>
          </a>
        </div>

        <p className="mt-8 text-xs text-zinc-600">
          Kostenlos · Android 8+ · iOS 15+
        </p>
        <Link href="/" className="mt-4 text-xs text-emerald-500/80 hover:text-emerald-400">
          ← Zurück zur Website
        </Link>
      </div>
    </main>
  );
}
