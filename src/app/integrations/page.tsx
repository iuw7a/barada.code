import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import IntegrationsClient from "./IntegrationsClient";

const PROVIDERS = ["GITHUB", "GITLAB", "VERCEL", "DATABASE", "CUSTOM_API"] as const;

export default async function IntegrationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/integrations");

  const rows = await prisma.integration.findMany({
    where: { userId: user.id },
    select: { provider: true, status: true, meta: true },
  });

  const integrations = PROVIDERS.map((provider) => {
    const row = rows.find((r) => r.provider === provider);
    return {
      provider,
      status: row?.status ?? "DISCONNECTED",
      meta: (row?.meta ?? {}) as Record<string, string>,
    };
  });

  return <IntegrationsClient integrations={integrations} />;
}
