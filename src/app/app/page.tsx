import { getTranslator } from "@/lib/i18n";
import PublicShell from "@/components/public/PublicShell";
import { Apple, Play, Bell } from "lucide-react";

export default async function AppPage() {
  const { t } = await getTranslator();
  return (
    <PublicShell title={t("app.title")} subtitle="Barada Code on the go — build and check your projects from your phone.">
      <div className="flex flex-col gap-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <span className="card flex items-center gap-3 p-5 text-ink-400">
            <Apple className="h-8 w-8" />
            <span>
              <span className="block font-medium text-ink-600 dark:text-ink-300">{t("app.store")}</span>
              <span className="text-xs">Coming soon</span>
            </span>
          </span>
          <span className="card flex items-center gap-3 p-5 text-ink-400">
            <Play className="h-8 w-8" />
            <span>
              <span className="block font-medium text-ink-600 dark:text-ink-300">{t("app.play")}</span>
              <span className="text-xs">Coming soon</span>
            </span>
          </span>
        </div>
        <div className="card p-6 text-sm text-ink-500 dark:text-ink-400">
          <p className="mb-2 flex items-center gap-2 font-medium text-ink-800 dark:text-ink-200">
            <Bell className="h-4 w-4 text-accent-600" /> What the apps will do
          </p>
          <ul className="flex flex-col gap-2">
            <li>• Chat with Barada and follow builds from anywhere</li>
            <li>• Preview published projects on your device</li>
            <li>• Voice conversations to describe ideas hands-free</li>
          </ul>
          <p className="mt-4 text-xs">
            Until then, the full experience — chat, editor, preview and publishing — works in the mobile browser at
            your Barada Code address.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
