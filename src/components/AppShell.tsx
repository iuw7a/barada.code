"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus, MessageSquare, FolderKanban, Library, Plug, Settings, HelpCircle,
  LogOut, PanelLeftClose, PanelLeftOpen, ChevronsUpDown, User,
} from "lucide-react";

type WorkspaceInfo = { id: string; name: string; isPersonal: boolean };
type Recent = { id: string; title: string };

const SIDEBAR_KEY = "barada.sidebar.collapsed";

export default function AppShell({
  user,
  workspaces,
  activeWorkspaceId,
  recents,
  children,
}: {
  user: { name: string; email: string };
  workspaces: WorkspaceInfo[];
  activeWorkspaceId: string;
  recents: Recent[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [wsCreateOpen, setWsCreateOpen] = useState(false);
  const [wsName, setWsName] = useState("");
  const [wsCreating, setWsCreating] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  function toggleSidebar() {
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      return !c;
    });
  }

  async function logout() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
    router.refresh();
  }

  const nav = [
    { href: "/chat", label: "New Chat", icon: MessageSquare },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/library", label: "Library", icon: Library },
    { href: "/integrations", label: "Integrations", icon: Plug },
  ];

  const activeWs =
    (pathname.startsWith("/workspace/")
      ? workspaces.find((w) => pathname === `/workspace/${w.id}`)
      : undefined) ??
    workspaces.find((w) => w.id === activeWorkspaceId) ??
    workspaces[0];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 z-40 flex flex-col border-e border-ink-200 bg-white transition-all duration-200 dark:border-ink-800 dark:bg-ink-900 md:relative md:translate-x-0 ${
          collapsed ? "w-16" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full md:rtl:translate-x-0"}`}
        style={{ insetInlineStart: 0 }}
      >
        {/* Workspace selector */}
        <div className="relative border-b border-ink-200 p-3 dark:border-ink-800">
          <button
            onClick={() => setWsOpen((v) => !v)}
            className={`flex w-full items-center gap-2 rounded-lg p-2 text-start hover:bg-ink-100 dark:hover:bg-ink-800 ${collapsed ? "justify-center" : ""}`}
            aria-expanded={wsOpen}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-600 text-sm font-semibold text-white">
              {(activeWs?.name ?? "P").charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-sm font-medium">{activeWs?.name}</span>
                <ChevronsUpDown className="h-4 w-4 text-ink-400" />
              </>
            )}
          </button>
          {wsOpen && !collapsed && (
            <div className="absolute inset-x-3 top-full z-50 mt-1 rounded-lg border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-800">
              {workspaces.map((w) => (
                <Link
                  key={w.id}
                  href={`/workspace/${w.id}`}
                  onClick={() => setWsOpen(false)}
                  className={`block px-3 py-2 text-sm hover:bg-ink-100 dark:hover:bg-ink-700 ${
                    w.id === activeWorkspaceId ? "font-medium text-accent-600" : ""
                  }`}
                >
                  {w.name}
                </Link>
              ))}
              <div className="border-t border-ink-200 dark:border-ink-700">
                {wsCreateOpen ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const name = wsName.trim();
                      if (!name || wsCreating) return;
                      setWsCreating(true);
                      try {
                        const res = await fetch("/api/workspaces", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name }),
                        });
                        if (res.ok) {
                          setWsCreateOpen(false);
                          setWsName("");
                          setWsOpen(false);
                          router.refresh();
                        }
                      } finally {
                        setWsCreating(false);
                      }
                    }}
                    className="flex items-center gap-1 p-2"
                  >
                    <input
                      autoFocus
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Workspace name"
                      maxLength={60}
                      className="min-w-0 flex-1 rounded-md border border-ink-200 px-2 py-1 text-sm outline-none focus:border-accent-500 dark:border-ink-600 dark:bg-ink-900"
                    />
                    <button
                      type="submit"
                      disabled={wsCreating || !wsName.trim()}
                      className="btn-primary shrink-0 px-2 py-1 text-xs"
                    >
                      {wsCreating ? "…" : "Add"}
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setWsCreateOpen(true)}
                    className="w-full px-3 py-2 text-start text-sm text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700"
                  >
                    + Create workspace
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* New + nav */}
        <nav className="flex-1 overflow-y-auto p-2 thin-scroll">
          <Link
            href="/chat"
            className={`mb-2 flex items-center gap-2 rounded-lg bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 ${collapsed ? "justify-center px-0" : ""}`}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && "New"}
          </Link>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100 ${
                pathname.startsWith(href) ? "bg-ink-100 font-medium text-ink-900 dark:bg-ink-800 dark:text-ink-100" : ""
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </Link>
          ))}

          {/* Recents */}
          {!collapsed && recents.length > 0 && (
            <div className="mt-4">
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-400">Recent</p>
              {recents.map((r) => (
                <Link
                  key={r.id}
                  href={`/chat/${r.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{r.title}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Bottom */}
        <div className="border-t border-ink-200 p-2 dark:border-ink-800">
          <Link
            href="/about"
            title="Learn More"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 ${collapsed ? "justify-center px-0" : ""}`}
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            {!collapsed && "Learn More"}
          </Link>
          <Link
            href="/settings"
            title="Settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 ${collapsed ? "justify-center px-0" : ""}`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && "Settings"}
          </Link>
          <button
            onClick={logout}
            title="Log out"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 ${collapsed ? "justify-center px-0" : ""}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Log out"}
          </button>
          <div className={`mt-1 flex items-center gap-2 border-t border-ink-200 pt-2 dark:border-ink-800 ${collapsed ? "justify-center" : "px-2"}`}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-200 dark:bg-ink-700">
              <User className="h-4 w-4 text-ink-500" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{user.name}</p>
                <p className="truncate text-xs text-ink-400">{user.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className={`mt-1 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 md:flex ${collapsed ? "justify-center px-0" : ""}`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          onClick={() => setMobileOpen(true)}
          className="btn-ghost absolute end-4 top-3 z-20 md:hidden"
          aria-label="Open menu"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
        <main className="min-w-0 flex-1 overflow-y-auto thin-scroll">{children}</main>
      </div>
    </div>
  );
}
