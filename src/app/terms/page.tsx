import MarketingShell from "@/components/public/MarketingShell";

export const metadata = {
  title: "Terms of Use — Barada Code",
  description: "The terms governing your use of Barada Code.",
};

const SECTIONS: Array<{ h: string; p: string[] }> = [
  {
    h: "1. Acceptance",
    p: [
      "By creating an account or using Barada Code you agree to these terms. If you do not agree, do not use the service.",
    ],
  },
  {
    h: "2. The service",
    p: [
      "Barada Code provides an AI agent that generates, executes and publishes software projects in isolated sandboxes, plus hosting for published projects on *.iuw7a.com subdomains.",
      "The service is provided \u201cas is\u201d. We continuously improve it and may change features; material adverse changes will be communicated to registered users.",
    ],
  },
  {
    h: "3. Your content & projects",
    p: [
      "You own the code and content you create. You grant us the limited license needed to store, execute and publish it on your instruction.",
      "You are responsible for your generated projects: do not use Barada Code to create malware, infringe intellectual property, or violate applicable law.",
    ],
  },
  {
    h: "4. Acceptable use",
    p: [
      "Do not: attack the platform or other users, abuse resources (cryptomining, spam, scraping at scale), bypass rate limits or sandbox isolation, or resell the service without a written agreement.",
      "We may suspend accounts that violate these rules; serious violations may be reported to authorities where legally required.",
    ],
  },
  {
    h: "5. Subscriptions & payments",
    p: [
      "Paid plans renew automatically until cancelled. Refunds are handled per the policy shown at purchase. Prices may change with 30 days notice.",
    ],
  },
  {
    h: "6. Availability",
    p: [
      "We target high availability but do not guarantee uninterrupted service. Sandboxes and published sites may be paused for maintenance or abuse prevention.",
    ],
  },
  {
    h: "7. Liability",
    p: [
      "To the maximum extent permitted by law, Barada Code is not liable for indirect or consequential damages. Total liability is limited to the amount you paid us in the 12 months before the claim.",
    ],
  },
  {
    h: "8. Termination",
    p: [
      "You can delete your account at any time. We may terminate accounts for material breach of these terms after notice where practical.",
    ],
  },
];

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 pb-20 pt-14">
        <h1 className="text-3xl font-bold">Terms of Use</h1>
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
          Questions about these terms? <a href="/contact" className="text-accent-600 hover:underline">Contact us</a>.
        </p>
      </article>
    </MarketingShell>
  );
}
