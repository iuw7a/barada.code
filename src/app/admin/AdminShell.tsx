"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Role = "ADMIN" | "SUPER_ADMIN";

const NAV: Array<{ section: string; items: Array<{ href: string; label: string; icon: string; super?: boolean }> }> = [
  { section: "Overview", items: [
    { href: "/admin", label: "Dashboard", icon: "▦" },
    { href: "/admin/analytics", label: "Analytics", icon: "◔" },
  ]},
  { section: "Users", items: [
    { href: "/admin/users", label: "All Users", icon: "◉" },
    { href: "/admin/users?filter=banned", label: "Suspended", icon: "⊘" },
  ]},
  { section: "Product", items: [
    { href: "/admin/projects", label: "Projects", icon: "▣" },
    { href: "/admin/ai", label: "AI Control", icon: "✦" },
    { href: "/admin/api-keys", label: "API Keys", icon: "🔑" },
    { href: "/admin/app", label: "Mobile App", icon: "📱" },
  ]},
  { section: "Subscriptions", items: [
    { href: "/admin/revenue", label: "Revenue", icon: "$" },
    { href: "/admin/ads", label: "Advertising", icon: "◉" },
  ]},
  { section: "System", items: [
    { href: "/admin/system", label: "System Health", icon: "⚡", super: true },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: "≡" },
  ]},
  { section: "Communication", items: [
    { href: "/admin/email", label: "Email Center", icon: "✉" },
  ]},
  { section: "Settings", items: [
    { href: "/admin/settings/profile", label: "Profile", icon: "●" },
    { href: "/admin/settings/appearance", label: "Appearance", icon: "◐" },
    { href: "/admin/settings/ai", label: "AI Settings", icon: "✧", super: true },
    { href: "/admin/settings/security", label: "Security", icon: "⛨", super: true },
  ]},
];

export default function AdminShell({ children, adminName, role }: { children: React.ReactNode; adminName: string; role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [cmdQ, setCmdQ] = useState("");
  const [cmdResults, setCmdResults] = useState<{ users: Array<{ id: string; name: string; email: string }>; projects: Array<{ id: string; name: string }> } | null>(null);
  const cmdInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); }
      if (e.key === "Escape") setCmd(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (cmd) setTimeout(() => cmdInput.current?.focus(), 50); else setCmdQ(""); }, [cmd]);

  useEffect(() => {
    if (!cmd || cmdQ.trim().length < 2) { setCmdResults(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(cmdQ)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setCmdResults)
        .catch(() => setCmdResults(null));
    }, 200);
    return () => clearTimeout(t);
  }, [cmdQ, cmd]);

  const crumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((p, i) => ({
      label: p === "admin" ? "Admin" : decodeURIComponent(p).replace(/^\w/, (c) => c.toUpperCase()),
      href: "/" + parts.slice(0, i + 1).join("/"),
    }));
  }, [pathname]);

  const nav = useCallback((href: string) => { setMobileOpen(false); router.push(href); }, [router]);

  const sidebar = (mobile: boolean) => (
    <aside
      className={mobile ? "fixed inset-y-0 left-0 z-50 w-72 translate-x-0" : `${collapsed ? "w-[68px]" : "w-60"} transition-all duration-200`}
      style={{ background: "linear-gradient(180deg,#0a0f0d 0%,#0c1210 100%)" }}
    >
      <div className="flex h-full flex-col border-r border-white/5">
        {/* brand */}
        <Link href="/admin" className="flex items-center gap-3 px-4 py-5" onClick={() => setMobileOpen(false)}>
          <img src="/barada-logo.png" alt="Barada Code" className="h-9 w-9 rounded-xl bg-emerald-500/10 object-contain p-1 ring-1 ring-emerald-500/30 shadow-[0_0_18px_rgba(16,185,129,0.25)]" />
          {!collapsed && (
            <span>
              <span className="block text-[13px] font-bold tracking-wide text-zinc-100">BARADA</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-400/80">Control Center</span>
            </span>
          )}
        </Link>

        {/* nav */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.super || role === "SUPER_ADMIN");
            if (!items.length) return null;
            return (
              <div key={group.section}>
                {!collapsed && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">{group.section}</p>}
                {items.map((item) => {
                  const active = pathname === item.href.split("?")[0];
                  return (
                    <button key={item.label} onClick={() => nav(item.href)}
                      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all ${
                        active
                          ? "bg-emerald-500/15 font-semibold text-emerald-300 ring-1 ring-emerald-500/25"
                          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className={`w-4 text-center text-[13px] ${active ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"}`}>{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                      {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* footer */}
        <div className="border-t border-white/5 p-3">
          <div className={`flex items-center gap-3 rounded-lg bg-white/[0.03] p-2 ${collapsed ? "justify-center" : ""}`}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30">
              {adminName.slice(0, 2).toUpperCase()}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-zinc-200">{adminName}</p>
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80">{role}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button onClick={() => setCmd(true)} className="mt-2 flex w-full items-center justify-between rounded-lg border border-white/5 px-3 py-1.5 text-[11px] text-zinc-500 hover:border-emerald-500/20 hover:text-zinc-300">
              Quick actions… <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
          )}
          <Link href="/chat" className={`mt-1 block rounded-lg px-3 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 ${collapsed ? "text-center" : ""}`}>
            {collapsed ? "←" : "← Back to app"}
          </Link>
        </div>
      </div>
    </aside>
  );

  // Root-cause fix for the white-area-below-content bug: the document
  // background (light ink-50 from the app body) must switch to dark while
  // any admin page is mounted — including overscroll regions.
  useEffect(() => {
    document.documentElement.classList.add("admin-dark");
    return () => document.documentElement.classList.remove("admin-dark");
  }, []);

  return (
    <div className="admin-root relative isolate flex text-zinc-200">
      {/* fixed ambient layer — always covers the viewport, never scrolls away */}
      <div aria-hidden className="admin-ambient fixed inset-0 -z-10" />
      {/* desktop sidebar */}
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar(false)}</div>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          {sidebar(true)}
        </div>
      )}

      {/* main */}
      <div className="min-w-0 flex-1">
        {/* top bar */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/5 bg-[#070b0a]/85 px-4 py-3 backdrop-blur-md">
          <button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-100 lg:hidden">☰</button>
          <button onClick={() => setCollapsed((v) => !v)} className="hidden h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-500 hover:text-zinc-100 lg:grid">☰</button>
          <nav className="flex items-center gap-1.5 text-xs text-zinc-500">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-700">/</span>}
                <Link href={c.href} className={i === crumbs.length - 1 ? "font-medium text-zinc-300" : "hover:text-zinc-400"}>{c.label}</Link>
              </span>
            ))}
          </nav>
          <div className="flex-1" />
          <button onClick={() => setCmd(true)} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-500 hover:border-emerald-500/25 hover:text-zinc-300">
            <span>Search…</span><kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <Link href="/admin/settings/profile" className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30">
            {adminName.slice(0, 2).toUpperCase()}
          </Link>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">{children}</main>
      </div>

      {/* command menu */}
      {cmd && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCmd(false)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#0d1412] shadow-[0_0_60px_rgba(16,185,129,0.12)]">
            <input ref={cmdInput} value={cmdQ} onChange={(e) => setCmdQ(e.target.value)}
              placeholder="Search users, projects, jump to page…"
              className="w-full border-b border-white/5 bg-transparent px-5 py-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
            <div className="max-h-80 overflow-y-auto p-2">
              {!cmdQ.trim() && (
                <div className="p-2">
                  {[
                    ["View analytics", "/admin/analytics"], ["Open API keys", "/admin/api-keys"], ["All users", "/admin/users"],
                    ["System health", "/admin/system"], ["Audit logs", "/admin/audit-logs"], ["Advertising", "/admin/ads"],
                  ].map(([label, href]) => (
                    <button key={href} onClick={() => { setCmd(false); router.push(href as string); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-emerald-500/10 hover:text-emerald-200">
                      <span className="text-emerald-400">→</span> {label}
                    </button>
                  ))}
                </div>
              )}
              {cmdResults?.users?.length ? (
                <div className="p-1">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Users</p>
                  {cmdResults.users.map((u) => (
                    <button key={u.id} onClick={() => { setCmd(false); router.push(`/admin/users/${u.id}`); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-emerald-500/10">
                      <span className="text-emerald-400">◉</span> <span className="font-medium">{u.name}</span>
                      <span className="text-zinc-600">{u.email}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {cmdResults?.projects?.length ? (
                <div className="p-1">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Projects</p>
                  {cmdResults.projects.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-zinc-400">
                      <span className="text-emerald-400">▣</span> {p.name}
                    </div>
                  ))}
                </div>
              ) : null}
              {cmdQ.trim().length >= 2 && !cmdResults && <p className="px-4 py-3 text-xs text-zinc-600">Searching…</p>}
              {cmdResults && !cmdResults.users?.length && !cmdResults.projects?.length && cmdQ.trim().length >= 2 && (
                <p className="px-4 py-3 text-xs text-zinc-600">No results.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
