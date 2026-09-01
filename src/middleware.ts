import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/chat", "/projects", "/settings", "/workspace", "/library", "/integrations"];
const SESSION_COOKIE = "barada_session";
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "iuw7a.com";

/**
 * 1) Published-project hosts ({slug}.iuw7a.com / {slug}.localhost) are
 *    rewritten to the public renderer /pub/{slug}/... — this is what makes
 *    publishing real: any project subdomain serves the live site.
 * 2) Private app pages redirect to /signin when no session cookie exists
 *    (deep verification still happens server-side per request).
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const hostname = host.split(":")[0]; // strip port

  // Published subdomain? ({slug}.iuw7a.com or {slug}.localhost)
  const isRootDomain = hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`;
  const endsWithRoot = hostname.endsWith(`.${ROOT_DOMAIN}`);
  const endsWithLocalhost = hostname.endsWith(".localhost") && hostname !== "localhost";

  if (!isRootDomain && (endsWithRoot || endsWithLocalhost)) {
    const slug = endsWithRoot
      ? hostname.slice(0, -(ROOT_DOMAIN.length + 1))
      : hostname.slice(0, -".localhost".length);
    if (slug && !slug.includes(".")) {
      const url = req.nextUrl.clone();
      url.pathname = `/pub/${slug}${req.nextUrl.pathname === "/" ? "/index.html" : req.nextUrl.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isProtected && !req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run everywhere except Next internals; skip /pub (already rewritten target).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|barada-logo.png|pub).*)"],
};
