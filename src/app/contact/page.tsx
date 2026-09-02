import { z } from "zod";
import MarketingShell from "@/components/public/MarketingShell";
import ContactForm from "./ContactForm";

export const metadata = {
  title: "Contact — Barada Code",
  description: "Get in touch with the Barada Code team.",
};

const contactEmail = process.env.CONTACT_EMAIL ?? "support@iuw7a.com";

export default function ContactPage() {
  const parsed = z.string().email().safeParse(contactEmail);
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Contact us</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-500 dark:text-ink-400">
            Questions, feedback, or partnership ideas — we read everything and reply to real messages.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_260px]">
          <div className="card p-6">
            <ContactForm />
          </div>
          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold">Email</h2>
              {parsed.success ? (
                <a href={`mailto:${contactEmail}`} className="mt-1 block break-all text-sm text-accent-600 hover:underline">
                  {contactEmail}
                </a>
              ) : (
                <p className="mt-1 text-xs text-ink-400">
                  Email support is not configured yet (set CONTACT_EMAIL). The form still works — messages are stored and processed.
                </p>
              )}
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold">Support</h2>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                Account or billing issues? Use the in-app Help Center for the fastest response.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </MarketingShell>
  );
}
