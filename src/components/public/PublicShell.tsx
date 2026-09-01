import Link from "next/link";
import { getTranslator } from "@/lib/i18n";

export default async function PublicShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { t } = await getTranslator();
  const links = [
    { href: "/about", label: t("about.title") },
    { href: "/story", label: t("story.title") },
    { href: "/app", label: t("app.title") },
    { href: "/help", label: t("help.title") },
  ];

  return (
    <main className="min-h-screen">
      <header className="glass sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/barada-logo.png" alt="Barada Code" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-semibold tracking-tight">Barada Code</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/chat" className="btn-ghost text-sm">{t("nav.newChat")}</Link>
            <Link href="/signup" className="btn-primary text-sm">{t("landing.cta.button")}</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-8 pt-14">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-3 text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </section>

      <article className="mx-auto max-w-3xl px-6 pb-20">{children}</article>

      <footer className="border-t border-ink-200 py-8 dark:border-ink-800">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <span className="text-xs text-ink-400">© {new Date().getFullYear()} Barada Code</span>
          <nav className="flex items-center gap-5 text-xs text-ink-400">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-ink-600 dark:hover:text-ink-300">
                {l.label}
              </Link>
            ))}
            <Link href="/" className="hover:text-ink-600 dark:hover:text-ink-300">{t("common.back")}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
