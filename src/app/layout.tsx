import type { Metadata } from "next";
import "./globals.css";
import { getTranslator } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Barada Code — Build with AI",
  description:
    "Describe what you want to build. Barada Code's AI engineer builds the real project with you.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dir } = await getTranslator();
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <body className="min-h-screen bg-ink-50 text-ink-900 antialiased dark:bg-ink-950 dark:text-ink-100">
        {children}
      </body>
    </html>
  );
}
