import MarketingShell from "@/components/public/MarketingShell";

export const metadata = {
  title: "Privacy Policy — Barada Code",
  description: "How Barada Code collects, uses and protects your data.",
};

const SECTIONS: Array<{ h: string; p: string[] }> = [
  {
    h: "1. What we collect",
    p: [
      "Account data: your name, email address and a securely hashed password. We never store your password in readable form.",
      "Content you create: projects, files, chat messages and deployments you build with Barada Code.",
      "Usage data: AI request counts, token usage and basic technical logs needed to operate and secure the service.",
    ],
  },
  {
    h: "2. How we use it",
    p: [
      "To provide the service: store your projects, run the AI agent, publish your sites and show your dashboard.",
      "To secure accounts: authentication sessions, abuse prevention and rate limiting.",
      "To communicate: transactional email (verification, security alerts, receipts). We do not sell your data or email address.",
    ],
  },
  {
    h: "3. AI processing",
    p: [
      "Prompts, project files and command output from your projects are processed by our AI provider to generate results. They are not used to train third-party models by default.",
      "Generated code runs in isolated sandboxes. Platform secrets are never injected into your projects.",
    ],
  },
  {
    h: "4. Storage & retention",
    p: [
      "Data is stored in a managed PostgreSQL database with encryption in transit. Uploaded assets are stored in dedicated object storage.",
      "You can delete projects at any time. Deleting your account removes your personal data within 30 days, except where retention is legally required.",
    ],
  },
  {
    h: "5. Cookies",
    p: [
      "We use a single httpOnly session cookie for authentication plus a locale preference cookie. No third-party advertising trackers.",
    ],
  },
  {
    h: "6. Your rights",
    p: [
      "Access, correction, export and deletion of your data. Contact us via the contact page to exercise these rights.",
    ],
  },
  {
    h: "7. Changes",
    p: [
      "If this policy changes materially, we will notify registered users by email before the change takes effect.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 pb-20 pt-14">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-400">Last updated: September 2026</p>
        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold">{s.h}</h2>
              {s.p.map((para, i) => (
                <p key={i} className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">{para}</p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-ink-500 dark:text-ink-400">
          Questions about privacy? <a href="/contact" className="text-accent-600 hover:underline">Contact us</a>.
        </p>
      </article>
    </MarketingShell>
  );
}
