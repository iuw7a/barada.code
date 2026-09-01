"use client";

import { ReactNode, useEffect, useState } from "react";
import { MessageSquare, Code2, Sparkles } from "lucide-react";
import ChatProjectPanel from "./ChatProjectPanel";

/**
 * Replit-style split shell: chat left, build area right.
 * Right side shows: project panel (when a project exists) → "Launching Barada"
 * splash (while the agent builds) → idle hint (before the first build).
 * Build activity arrives via window events dispatched by ChatView.
 */
export default function ChatSplit({
  chat,
  projectId,
}: {
  chat: ReactNode;
  projectId: string | null;
}) {
  const [mobileTab, setMobileTab] = useState<"chat" | "project">("chat");
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    const onStart = () => {
      setBuilding(true);
      setMobileTab("project");
    };
    const onEnd = () => setBuilding(false);
    window.addEventListener("barada:build-start", onStart);
    window.addEventListener("barada:build-end", onEnd);
    return () => {
      window.removeEventListener("barada:build-start", onStart);
      window.removeEventListener("barada:build-end", onEnd);
    };
  }, []);

  // This shell mounts when the chat page loads; on mobile land on the project
  // side only while building. Desktop shows both columns regardless.
  useEffect(() => {
    if (projectId || building) setMobileTab("project");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPanel = !!projectId;

  return (
    <div className="flex h-full min-h-0">
      {/* Chat column */}
      <div
        className={`h-full min-w-0 flex-col border-e border-ink-200 dark:border-ink-800 lg:flex lg:w-[440px] lg:shrink-0 ${
          mobileTab === "chat" ? "flex w-full" : "hidden"
        }`}
      >
        {chat}
      </div>

      {/* Build area column */}
      <div
        className={`h-full min-w-0 flex-1 lg:block ${mobileTab === "project" ? "block" : "hidden"}`}
      >
        {showPanel ? (
          <ChatProjectPanelLive projectId={projectId!} building={building} />
        ) : building ? (
          <LaunchSplash />
        ) : (
          <IdleState />
        )}
      </div>

      {/* Mobile toggle */}
      <div className="fixed bottom-24 end-4 z-40 flex gap-1 rounded-full border border-ink-200 bg-white p-1 shadow-lg lg:hidden dark:border-ink-700 dark:bg-ink-900">
        <button
          onClick={() => setMobileTab("chat")}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${
            mobileTab === "chat" ? "bg-accent-600 text-white" : "text-ink-500 dark:text-ink-300"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" /> Chat
        </button>
        <button
          onClick={() => setMobileTab("project")}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${
            mobileTab === "project" ? "bg-accent-600 text-white" : "text-ink-500 dark:text-ink-300"
          }`}
        >
          <Code2 className="h-3.5 w-3.5" /> Project
        </button>
      </div>
    </div>
  );
}

/** Live panel: remounts (fresh files + preview) when a build finishes. */
function ChatProjectPanelLive({ projectId, building }: { projectId: string; building: boolean }) {
  const [buildEpoch, setBuildEpoch] = useState(0);
  const [wasBuilding, setWasBuilding] = useState(false);
  useEffect(() => {
    if (wasBuilding && !building) setBuildEpoch((n) => n + 1);
    setWasBuilding(building);
  }, [building, wasBuilding]);
  return <ChatProjectPanel key={buildEpoch} projectId={projectId} />;
}

/** "Launching Barada — building your app" splash with the animated logo. */
function LaunchSplash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-white to-ink-50 dark:from-ink-900 dark:to-ink-950">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/barada-logo.png"
        alt=""
        className="logo-think h-16 w-16 rounded-2xl object-contain shadow-lg shadow-accent-600/20"
      />
      <div className="text-center">
        <p className="text-lg font-semibold">Launching Barada</p>
        <p className="mt-1 text-sm text-ink-400">Building your app…</p>
      </div>
      <div className="mt-2 h-1 w-48 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-accent-600" />
      </div>
    </div>
  );
}

/** Idle right side before the first build. */
function IdleState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-800">
        <Sparkles className="h-6 w-6 text-accent-600" />
      </div>
      <p className="text-sm font-medium">Barada builds your app here</p>
      <p className="max-w-64 text-xs text-ink-400">
        Describe your idea in the chat — files, code and a live preview appear in this space.
      </p>
    </div>
  );
}
