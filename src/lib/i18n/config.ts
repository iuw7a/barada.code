export const LANGUAGES = ["en", "ar", "de", "es", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ar: "العربية",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
};

export const RTL_LANGUAGES: readonly Language[] = ["ar"];
export const isRtl = (lang: Language) => RTL_LANGUAGES.includes(lang);
export const dirOf = (lang: Language): "rtl" | "ltr" => (isRtl(lang) ? "rtl" : "ltr");

export const DEFAULT_LANGUAGE: Language = "en";
export const LOCALE_COOKIE = "barada_locale";

export function isLanguage(x: string): x is Language {
  return (LANGUAGES as readonly string[]).includes(x);
}
