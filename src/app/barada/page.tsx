import Link from "next/link";
import { Sparkles, Hammer, Globe, ShieldCheck, Boxes, Zap } from "lucide-react";
import MarketingShell from "@/components/public/MarketingShell";

export const metadata = {
  title: "Barada — Build real software by describing it",
  description: "Barada Code turns plain language into working, deployable software.",
};

export default function BaradaPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-600/10 px-3 py-1 text-xs font-medium text-accent-600 dark:text-accent-400">
            <Sparkles className="h-3.5 w-3.5" /> The Barada ecosystem
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Barada builds <span className="text-accent-600 dark:text-accent-400">real software</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-ink-500 dark:text-ink-400">
            Barada Code is an AI software engineering platform. Describe what you want — Barada plans,
            writes the code, runs it in a real sandbox, tests it, and publishes it to the web.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary">Start building free</Link>
            <Link href="/about" className="btn-ghost">About us</Link>
          </div>
        </div>

        {/* What Barada is */}
        <section className="mt-20 grid gap-6 sm:grid-cols-2">
          <div className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Boxes className="h-5 w-5 text-accent-600" /> What Barada is
            </h2>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
              Barada is the company behind a family of AI products. Our mission: anyone should be able to
              create real, working software — not mockups — by simply describing it.
            </p>
          </div>
          <div className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Hammer className="h-5 w-5 text-accent-600" /> What Barada Code is
            </h2>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
              Barada Code is our flagship product: an AI engineer with a real sandbox. It installs
              dependencies, builds, runs servers, reads errors and fixes them — the way a senior
              developer would.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold">How the ecosystem works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Sparkles, title: "1 · Describe", text: "Tell Barada what to build, in your language. It plans the architecture." },
              { icon: Hammer, title: "2 · It builds", text: "Barada writes the code in a real workspace: frontend, backend, database." },
              { icon: Globe, title: "3 · It runs & publishes", text: "The app is verified (build + boot + health checks) and published to your subdomain." },
            ].map((s) => (
              <div key={s.title} className="card p-6 text-center">
                <s.icon className="mx-auto h-8 w-8 text-accent-600" />
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Hammer, title: "Real execution", text: "Every project gets a sandboxed Linux workspace with npm, git and a shell." },
            { icon: Zap, title: "Verified builds", text: "Nothing is 'done' until it installs, builds, boots and responds." },
            { icon: Globe, title: "One-click publish", text: "yourproject.iuw7a.com with custom domain support and DNS verification." },
            { icon: ShieldCheck, title: "Secure by design", text: "Isolated sandboxes, encrypted secrets, audited admin actions." },
          ].map((f) => (
            <div key={f.title} className="card p-5">
              <f.icon className="h-5 w-5 text-accent-600" />
              <h3 className="mt-2 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{f.text}</p>
            </div>
          ))}
        </section>

        {/* Vision + contact */}
        <section className="mt-16 rounded-3xl bg-gradient-to-br from-accent-600/10 to-transparent p-8 text-center ring-1 ring-accent-600/20">
          <h2 className="text-2xl font-bold">Our vision</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-500 dark:text-ink-400">
            A world where the distance between an idea and a working product is one sentence.
            Barada Code is the first step: a true AI software engineer for everyone.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary">Create your account</Link>
            <Link href="/contact" className="btn-ghost">Contact us</Link>
          </div>
          <p className="mt-6 text-xs text-ink-400">
            Questions? <a href="mailto:hello@iuw7a.com" className="text-accent-600 hover:underline">hello@iuw7a.com</a>
          </p>
        </section>
      </main>
    </MarketingShell>
  );
}
