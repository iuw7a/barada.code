import Link from "next/link";

/** Shell for marketing/product/legal pages — logo header + full footer. */
export default function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/barada-logo.png" alt="Barada Code" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-semibold tracking-tight">Barada Code</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/chat" className="btn-ghost text-sm">Open app</Link>
            <Link href="/signup" className="btn-primary text-sm">Sign up</Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-ink-200 py-8 dark:border-ink-800">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <span className="text-xs text-ink-400">© {new Date().getFullYear()} Barada Code</span>
          <nav className="flex flex-wrap items-center justify-center gap-5 text-xs text-ink-400">
            <Link href="/barada" className="hover:text-ink-600 dark:hover:text-ink-300">Barada</Link>
            <Link href="/about" className="hover:text-ink-600 dark:hover:text-ink-300">About</Link>
            <Link href="/contact" className="hover:text-ink-600 dark:hover:text-ink-300">Contact</Link>
            <Link href="/privacy" className="hover:text-ink-600 dark:hover:text-ink-300">Privacy</Link>
            <Link href="/terms" className="hover:text-ink-600 dark:hover:text-ink-300">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
