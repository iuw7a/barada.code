import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function BillingSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/settings/billing");

  const sub = await prisma.subscription.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Billing</h2>
      <div className="card mb-6 flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-ink-500">Current plan</p>
          <p className="text-xl font-semibold">{sub?.plan ?? "FREE"}</p>
        </div>
        <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-300">
          {sub?.status ?? "ACTIVE"}
        </span>
      </div>
      <div className="card p-6 text-sm text-ink-500">
        <p className="font-medium text-ink-800 dark:text-ink-200">Paid plans are coming soon.</p>
        <p className="mt-2">
          Barada Code is in early access — your account is on the FREE plan. Subscription management,
          invoicing and plan upgrades will appear here when paid tiers launch.
        </p>
      </div>
    </div>
  );
}
