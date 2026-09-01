import Link from "next/link";
import { getTranslator } from "@/lib/i18n";
import PublicShell from "@/components/public/PublicShell";
import { Sparkles, Eye, Globe, Languages } from "lucide-react";

export default async function AboutPage() {
  const { t } = await getTranslator();

  const pillars = [
    { icon: Sparkles, title: t("landing.features.ai"), desc: t("landing.features.ai.desc") },
    { icon: Eye, title: t("landing.features.preview"), desc: t("landing.features.preview.desc") },
    { icon: Globe, title: t("landing.publish.title"), desc: t("landing.publish.desc") },
    { icon: Languages, title: t("landing.features.i18n"), desc: t("landing.features.i18n.desc") },
  ];

  return (
    <PublicShell title={t("about.title")} subtitle={t("footer.tagline")}>
      <div className="flex flex-col gap-10">
        <p className="text-pretty leading-relaxed text-ink-600 dark:text-ink-300">
          {t("landing.story.body")}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-5">
              <Icon className="mb-3 h-5 w-5 text-accent-600" aria-hidden />
              <h2 className="mb-1 text-sm font-medium">{title}</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">{desc}</p>
            </div>
          ))}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold">What you can build</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-600 dark:text-ink-300">
            <li>• {t("landing.how.s1.desc")}</li>
            <li>• {t("landing.how.s2.desc")}</li>
            <li>• {t("landing.how.s3.desc")}</li>
            <li>• {t("landing.how.s4.desc")}</li>
          </ul>
        </div>

        <div className="text-center">
          <Link href="/signup" className="btn-primary px-8 py-3">{t("landing.cta.button")}</Link>
        </div>
      </div>
    </PublicShell>
  );
}
