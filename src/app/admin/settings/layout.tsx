import Link from "next/link";

const TABS = [
  { href: "/admin/settings/profile", label: "Profile" },
  { href: "/admin/settings/appearance", label: "Appearance" },
  { href: "/admin/settings/ai", label: "AI" },
  { href: "/admin/settings/security", label: "Security" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Settings</h1>
        <p className="mt-0.5 text-xs text-zinc-500">Control center configuration.</p>
      </div>
      <nav className="flex flex-wrap gap-1.5 border-b border-white/5 pb-3">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
