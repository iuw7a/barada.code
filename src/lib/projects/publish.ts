import { z } from "zod";

/** Root domain that published projects are served under. */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "iuw7a.com";

/** Subdomains that must never be taken by a project. */
export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "pub", "mail", "ftp", "blog",
  "docs", "status", "support", "help", "cdn", "static", "auth",
  "dashboard", "settings", "login", "signin", "signup", "root",
]);

export const SubdomainSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "3–63 chars: lowercase letters, digits, hyphens")
  .refine((s) => !RESERVED_SUBDOMAINS.has(s), "This subdomain is reserved")
  .refine((s) => !s.includes("--"), "Double hyphens are not allowed");

export function validateSubdomain(input: string): { ok: true; slug: string } | { ok: false; error: string } {
  const parsed = SubdomainSchema.safeParse(input.toLowerCase().trim());
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid subdomain" };
  }
  return { ok: true, slug: parsed.data };
}

/** Public URL of a published project (display only). */
export function publicUrl(subdomain: string): string {
  const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
  const port = process.env.PORT ?? "";
  const hostPart =
    process.env.NODE_ENV === "production"
      ? `${subdomain}.${ROOT_DOMAIN}`
      : `${subdomain}.localhost${port ? `:${port}` : ""}`;
  return `${scheme}://${hostPart}`;
}

/** The CNAME target a custom domain must point to. */
export function cnameTarget(subdomain: string): string {
  return `${subdomain}.${ROOT_DOMAIN}`;
}
