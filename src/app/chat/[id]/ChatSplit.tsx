"use client";

import { ReactNode, useEffect, useState } from "react";
import { MessageSquare, Code2, Hammer } from "lucide-react";
import ChatProjectPanel from "./ChatProjectPanel";

/**
 * Split shell with two modes:
 * - CHAT MODE (default): the chat takes the full width — normal conversation.
 * - BUILD MODE: activated only when an actual build starts (the agent's
 *   stream emits tool activity), showing the workspace beside the chat.
 * Mobile: single pane with a bottom toggle.
 */
export default function ChatSplit({
  chat,
  projectId,
}: {
  chat: ReactNode;
  projectId: string | null;
}) {
  const [buildMode, setBuildMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "project">("chat");
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    const onStart = () => {
      setBuilding(true);
      setBuildMode(true); // a real build started → workspace opens
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

  // If this chat already has a project, offer build mode but keep the user in
  // chat view on mobile (they can toggle to the workspace anytime).
  const showPanel = buildMode && !!projectId;

  return (
    <div className="flex h-full min-h-0">
      {/* Chat column */}
      <div
        className={`h-full min-w-0 flex-col border-e border-ink-200 dark:border-ink-800 ${
          showPanel ? "lg:flex lg:w-[440px] lg:shrink-0" : "flex flex-1"
        } ${mobileTab === "chat" || !showPanel ? "flex w-full" : "hidden"}`}
      >
        {chat}
      </div>

      {/* Build area column */}
      {projectId && (
        <div className={`h-full min-w-0 flex-1 lg:block ${mobileTab === "project" && showPanel ? "block" : "hidden"}`}>
          <ChatProjectPanelLive projectId={projectId} building={building} />
        </div>
      )}

      {/* Mode controls */}
      <div className="fixed bottom-24 end-4 z-40 flex gap-1 rounded-full border border-ink-200 bg-white p-1 shadow-lg lg:hidden dark:border-ink-700 dark:bg-ink-900">
        <button
          onClick={() => setMobileTab("chat")}
          className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm ${
            mobileTab === "chat" ? "bg-accent-600 text-white" : "text-ink-500 dark:text-ink-300"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" /> Chat
        </button>
        {projectId && (
          <button
            onClick={() => {
              if (!buildMode) setBuildMode(true);
              setMobileTab("project");
            }}
            className={`flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm ${
              mobileTab === "project" ? "bg-accent-600 text-white" : "text-ink-500 dark:text-ink-300"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" /> Workspace
          </button>
        )}
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

export function BuildBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-600/10 px-2 py-0.5 text-[11px] text-accent-600 dark:text-accent-400">
      <Hammer className="h-3 w-3" /> building
    </span>
  );
}
