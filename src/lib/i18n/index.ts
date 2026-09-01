import { cookies } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_NAMES,
  LOCALE_COOKIE,
  dirOf,
  isLanguage,
  type Language,
} from "./config";
import en, { type Dictionary, type TranslationKey } from "./dictionaries/en";
import ar from "./dictionaries/ar";
import de from "./dictionaries/de";
import es from "./dictionaries/es";
import fr from "./dictionaries/fr";

const DICTIONARIES: Record<Language, Dictionary> = { en, ar, de, es, fr };

/** Resolve the active language from the cookie (server-side). */
export async function getLanguage(): Promise<Language> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value ?? "";
  return isLanguage(raw) ? raw : DEFAULT_LANGUAGE;
}

export function getDictionary(lang: Language): Dictionary {
  return DICTIONARIES[lang] ?? en;
}

/** Server helper: t("landing.hero.title") with the active language. */
export async function getTranslator(): Promise<{
  lang: Language;
  dir: "rtl" | "ltr";
  t: (key: TranslationKey) => string;
}> {
  const lang = await getLanguage();
  const dict = getDictionary(lang);
  return {
    lang,
    dir: dirOf(lang),
    t: (key: TranslationKey) => dict[key] ?? en[key] ?? key,
  };
}

export type { Language, TranslationKey, Dictionary };
export { LANGUAGES, LANGUAGE_NAMES, LOCALE_COOKIE, dirOf, isLanguage, DEFAULT_LANGUAGE };
