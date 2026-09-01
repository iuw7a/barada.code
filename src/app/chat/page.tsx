import ChatEmpty from "./ChatEmpty";
import { getTranslator } from "@/lib/i18n";

export default async function NewChatPage() {
  const { t } = await getTranslator();
  return <ChatEmpty greeting={t("chat.greeting")} />;
}
