import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslator } from "@/lib/i18n";
import { getSessionUser } from "@/lib/auth/session";
import {
  Sparkles, Eye, FolderKanban, Languages, Globe, MessageSquareText,
  Code2, Rocket, ArrowRight, Check,
} from "lucide-react";

export default async function LandingPage() {
  const { t } = await getTranslator();
  const user = await getSessionUser();
  if (user) redirect("/chat");

  const navLinks = [
    { href: "#how", label: t("landing.how.title") },
    { href: "#features", label: t("landing.features.title") },
    { href: "#publish", label: t("landing.publish.title") },
    { href: "/story", label: t("story.title") },
    { href: "/help", label: t("help.title") },
  ];

  const steps = [
    { icon: MessageSquareText, title: t("landing.how.s1.title"), desc: t("landing.how.s1.desc") },
    { icon: Code2, title: t("landing.how.s2.title"), desc: t("landing.how.s2.desc") },
    { icon: Eye, title: t("landing.how.s3.title"), desc: t("landing.how.s3.desc") },
    { icon: Rocket, title: t("landing.how.s4.title"), desc: t("landing.how.s4.desc") },
  ];

  const features = [
    { icon: Sparkles, title: t("landing.features.ai"), desc: t("landing.features.ai.desc") },
    { icon: Eye, title: t("landing.features.preview"), desc: t("landing.features.preview.desc") },
    { icon: FolderKanban, title: t("landing.features.projects"), desc: t("landing.features.projects.desc") },
    { icon: Globe, title: t("landing.publish.title"), desc: t("landing.publish.desc") },
    { icon: Languages, title: t("landing.features.i18n"), desc: t("landing.features.i18n.desc") },
  ];

  return (
    <main className="relative overflow-hidden">
      {/* Nav */}
      <header className="glass sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/barada-logo.png" alt="Barada Code" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-semibold tracking-tight">Barada Code</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-ink-600 dark:text-ink-300 md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-ink-900 dark:hover:text-ink-100">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/signin" className="btn-ghost text-sm">{t("auth.signin.submit")}</Link>
            <Link href="/signup" className="btn-primary text-sm">{t("auth.signup.submit")}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.15),transparent)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/barada-logo.png"
          alt="Barada Code"
          className="logo-float mx-auto mb-8 h-20 w-20 rounded-2xl object-contain shadow-xl shadow-accent-600/25"
        />
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          {t("landing.hero.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-ink-500 dark:text-ink-400 sm:text-lg">
          {t("landing.hero2.sub")}
        </p>

        <form action="/signup" className="mx-auto mt-10 max-w-2xl">
          <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
            <input
              type="text"
              name="idea"
              placeholder={t("landing.hero.placeholder")}
              className="flex-1 rounded-xl bg-transparent p-2 text-start outline-none placeholder:text-ink-400"
              aria-label={t("landing.hero.title")}
            />
            <button type="submit" className="btn-primary shrink-0 px-6">
              {t("landing.hero.cta")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-400">{t("landing.hero.hint")}</p>
        </form>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-semibold">{t("landing.how.title")}</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="card relative p-6">
              <span className="absolute end-4 top-4 text-4xl font-bold text-ink-100 dark:text-ink-800">{i + 1}</span>
              <Icon className="mb-4 h-6 w-6 text-accent-600" aria-hidden />
              <h3 className="mb-2 font-medium">{title}</h3>
              <p className="text-sm text-ink-500 dark:text-ink-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-semibold">{t("landing.features.title")}</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6 transition-shadow hover:shadow-md">
              <Icon className="mb-4 h-6 w-6 text-accent-600" aria-hidden />
              <h3 className="mb-2 font-medium">{title}</h3>
              <p className="text-sm text-ink-500 dark:text-ink-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Publishing */}
      <section id="publish" className="mx-auto max-w-6xl px-6 py-20">
        <div className="card grid items-center gap-10 overflow-hidden p-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold">{t("landing.publish.title")}</h2>
            <p className="mt-4 text-ink-500 dark:text-ink-400">{t("landing.publish.desc")}</p>
            <ul className="mt-6 flex flex-col gap-3 text-sm">
              {["yourname.iuw7a.com", "coffeeshop.iuw7a.com", "my-portfolio.iuw7a.com"].map((d) => (
                <li key={d} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent-600" />
                  <span className="font-mono">{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-ink-200 bg-ink-50 p-6 dark:border-ink-800 dark:bg-ink-900">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-accent-500" />
              <span className="ms-2 rounded-md bg-white px-2 py-0.5 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                coffee-shop.iuw7a.com
              </span>
            </div>
            <div className="space-y-3">
              <div className="h-8 w-2/3 rounded-lg bg-accent-600/80" />
              <div className="h-3 w-full rounded bg-ink-200 dark:bg-ink-700" />
              <div className="h-3 w-5/6 rounded bg-ink-200 dark:bg-ink-700" />
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="h-16 rounded-lg bg-ink-200 dark:bg-ink-700" />
                <div className="h-16 rounded-lg bg-ink-200 dark:bg-ink-700" />
                <div className="h-16 rounded-lg bg-ink-200 dark:bg-ink-700" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold">{t("story.title")}</h2>
        <p className="mt-6 text-pretty leading-relaxed text-ink-500 dark:text-ink-400">{t("landing.story.body")}</p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="glass rounded-3xl p-12">
          <h2 className="text-3xl font-semibold">{t("landing.cta.title")}</h2>
          <p className="mt-3 text-ink-500 dark:text-ink-400">{t("footer.tagline")}</p>
          <Link href="/signup" className="btn-primary mt-8 px-8 py-3 text-base">
            {t("landing.cta.button")}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-200 py-10 dark:border-ink-800">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/barada-logo.png" alt="" className="h-6 w-6 rounded-md object-contain" />
              <span className="text-sm font-medium">Barada Code</span>
              <span className="text-xs text-ink-400">— {t("footer.tagline")}</span>
            </div>
            <nav className="flex items-center gap-5 text-xs text-ink-400">
              <Link href="/about" className="hover:text-ink-600 dark:hover:text-ink-300">{t("about.title")}</Link>
              <Link href="/story" className="hover:text-ink-600 dark:hover:text-ink-300">{t("story.title")}</Link>
              <Link href="/app" className="hover:text-ink-600 dark:hover:text-ink-300">{t("app.title")}</Link>
              <Link href="/help" className="hover:text-ink-600 dark:hover:text-ink-300">{t("help.title")}</Link>
            </nav>
          </div>
          <p className="mt-6 text-center text-xs text-ink-400">© {new Date().getFullYear()} Barada Code</p>
        </div>
      </footer>
    </main>
  );
}
