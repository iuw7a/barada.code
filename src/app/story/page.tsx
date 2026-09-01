import { getTranslator } from "@/lib/i18n";
import PublicShell from "@/components/public/PublicShell";

export default async function StoryPage() {
  const { t } = await getTranslator();

  const chapters = [
    {
      year: "The problem",
      text: "Everyone has ideas for software — a shop that needs a website, a student with a project, a founder with a prototype in their head. But between \"I have an idea\" and \"it's running\" sits an enormous wall of tooling, languages and setup. Tools got better; the wall remained.",
    },
    {
      year: "The insight",
      text: "The breakthrough isn't a better code editor — it's removing the translation step entirely. If you can describe what you want in your own language, an AI engineer should handle the translation into real, working files. Not a toy demo: a real project you own and can keep iterating on.",
    },
    {
      year: "The product",
      text: "Barada Code pairs a conversational AI engineer with a complete development environment: real projects with real file systems, a professional editor, live previews, and one-click publishing to your own subdomain. Chat is the interface; a serious platform is the result.",
    },
    {
      year: "Today",
      text: "Barada Code speaks five languages — English, العربية, Deutsch, Español and Français — with full right-to-left support, because the next hundred million builders won't all speak English. This is version one of a platform that intends to grow for a long time.",
    },
  ];

  return (
    <PublicShell title={t("story.title")} subtitle={t("footer.tagline")}>
      <div className="flex flex-col gap-8">
        {chapters.map((c) => (
          <section key={c.year} className="card p-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-accent-600">{c.year}</p>
            <p className="text-pretty leading-relaxed text-ink-600 dark:text-ink-300">{c.text}</p>
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
