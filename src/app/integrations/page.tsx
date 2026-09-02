import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import IntegrationsClient from "./IntegrationsClient";

/**
 * Integrations: only providers with REAL implemented behavior are listed.
 * GitHub/Vercel/etc. connections were advertised but never functional —
 * they are hidden until a real implementation ships.
 * DATA connection = external databases for generated projects (real, stored
 * encrypted and injected into the sandbox at run time).
 */
const PROVIDERS = ["DATA"] as const;

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
