import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import AiClient from "./AiClient";

export default async function AiSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/settings/ai");

  const row = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const json = (row?.json ?? {}) as { ai?: { model?: string; autoRun?: boolean } };

  const jobs = await prisma.aIJob.groupBy({
    by: ["status"],
    where: { userId: user.id },
    _count: true,
  });
  const tokens = await prisma.aIJob.aggregate({
    where: { userId: user.id },
    _sum: { completionTokens: true, promptTokens: true },
  });

  return (
    <AiClient
      model={json.ai?.model ?? ""}
      autoRun={json.ai?.autoRun ?? true}
      usage={{
        jobs: jobs.reduce((acc, j) => acc + j._count, 0),
        completed: jobs.find((j) => j.status === "COMPLETED")?._count ?? 0,
        failed: jobs.find((j) => j.status === "FAILED")?._count ?? 0,
        tokens: (tokens._sum.promptTokens ?? 0) + (tokens._sum.completionTokens ?? 0),
      }}
    />
  );
}
