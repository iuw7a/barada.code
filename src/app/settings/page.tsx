import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import SettingsGeneralClient from "./SettingsGeneralClient";
import { LANGUAGES, LANGUAGE_NAMES, type Language } from "@/lib/i18n/config";

export default async function GeneralSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/settings");

  const row = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const settings = (row?.json ?? {}) as {
    language?: Language;
    theme?: string;
    ai?: { autoRun?: boolean; model?: string };
    editor?: { fontSize?: number };
    preview?: { device?: "desktop" | "tablet" | "mobile" };
    notifications?: { email?: boolean; build?: boolean };
  };

  return (
    <SettingsGeneralClient
      languages={LANGUAGES.map((l) => ({ code: l, name: LANGUAGE_NAMES[l] }))}
      currentLanguage={settings.language ?? "en"}
      email={user.email}
      preferences={{
        autoRun: settings.ai?.autoRun ?? true,
        defaultModel: settings.ai?.model,
        editorFontSize: settings.editor?.fontSize ?? 14,
        previewDevice: settings.preview?.device ?? "desktop",
        notifications: settings.notifications ?? {},
      }}
    />
  );
}
