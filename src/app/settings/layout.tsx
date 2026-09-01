import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";

const SECTIONS = [
  { href: "/settings", label: "General" },
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/ai", label: "AI" },
  { href: "/settings/billing", label: "Billing" },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/settings");

  return (
    <div className="mx-auto flex max-w-5xl gap-10 px-6 py-10">
      <aside className="w-44 shrink-0">
        <h1 className="mb-4 text-lg font-semibold">Settings</h1>
        <nav className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
