import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import ChatView from "./ChatView";
import ChatSplit from "./ChatSplit";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voice?: string }>;
}) {
  const { id } = await params;
  const { voice } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=/chat/${id}`);

  const chat = await prisma.chat.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!chat || chat.userId !== user.id) redirect("/chat");

  const chatView = (
    <ChatView
      chatId={chat.id}
      projectId={chat.projectId}
      autoStartVoice={voice === "1"}
      initialStatus={chat.status}
      initialMessages={chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        status: m.status,
        toolCalls: m.toolCalls,
      }))}
    />
  );

  // Replit-style split: chat left, build area right — splash while the agent
  // works, project panel (files / code / preview) once a project exists.
  return <ChatSplit chat={chatView} projectId={chat.projectId} />;
}
