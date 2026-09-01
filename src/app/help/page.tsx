import { getTranslator } from "@/lib/i18n";
import PublicShell from "@/components/public/PublicShell";
import { MessageSquareText, FolderKanban, Globe, ShieldCheck } from "lucide-react";

export default async function HelpPage() {
  const { t } = await getTranslator();

  const categories = [
    {
      icon: MessageSquareText,
      title: "Getting started",
      items: [
        { q: "How do I start my first project?", a: "Sign up, open the chat and describe your idea — e.g. 'a coffee shop website called Moon Coffee'. Barada asks if anything critical is missing, then builds the project." },
        { q: "What can I ask for?", a: "Websites, dashboards, portfolios, landing pages and more. Say what you want, in your own words — Arabic, English, German, Spanish or French." },
        { q: "The AI asked me a question — do I have to answer?", a: "Only if a critical detail is missing (like a brand name). Otherwise Barada starts building right away. If it guesses wrong, just tell it in chat." },
      ],
    },
    {
      icon: FolderKanban,
      title: "Projects & editing",
      items: [
        { q: "Can I edit what Barada builds?", a: "Yes. Every project has a real file system and a code editor (Ctrl/Cmd+S saves). You can edit files yourself or ask Barada to change them in chat." },
        { q: "Where do I see the result?", a: "Open the project — the workspace shows the file explorer, editor and a live preview side by side." },
      ],
    },
    {
      icon: Globe,
      title: "Publishing",
      items: [
        { q: "How do I put my project online?", a: "Open the project and press Publish. Choose a subdomain — your site goes live at yourname.iuw7a.com instantly." },
        { q: "Can I use my own domain?", a: "Yes. In the Publish panel, add your custom domain and point a CNAME record at the shown target. DNS is verified automatically once it propagates." },
        { q: "How do I take a site offline?", a: "Press Unpublish in the same panel. Your project and files stay untouched — you can redeploy anytime." },
      ],
    },
    {
      icon: ShieldCheck,
      title: "Account & security",
      items: [
        { q: "Is my code private?", a: "Projects are private to your workspace by default. Nothing is public unless you publish it." },
        { q: "How do I change my password or language?", a: "Settings → Security for passwords and sessions; Settings → General for language and theme. Arabic switches the whole interface to RTL." },
      ],
    },
  ];

  return (
    <PublicShell title={t("help.title")} subtitle="Everything about building, editing and publishing with Barada Code.">
      <div className="flex flex-col gap-8">
        {categories.map(({ icon: Icon, title, items }) => (
          <section key={title}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Icon className="h-5 w-5 text-accent-600" aria-hidden /> {title}
            </h2>
            <div className="flex flex-col gap-3">
              {items.map((topic) => (
                <details key={topic.q} className="card p-5">
                  <summary className="cursor-pointer font-medium">{topic.q}</summary>
                  <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{topic.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
