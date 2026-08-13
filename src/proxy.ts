import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, STATIC_SECURITY_HEADERS } from "@/lib/securityHeaders";

// The matcher now runs on every page request (static assets and image
// optimization excluded) so the nonce-based CSP and static security headers
// (X-Frame-Options, etc.) land on public pages too — /, /login, /explore and
// friends were previously skipped entirely and shipped with no security
// headers at all. /explore itself is still intentionally NOT auth-gated —
// pre-signup visitors can browse read-only (Section 7.1); compare/save/action
// routes gate client-side. What the matcher used to buy by excluding public
// routes was skipping the Supabase auth round-trip (several hundred ms to
// several seconds in the proxy, see the dev logs) for pages that don't need
// it; that's now handled by only running the auth check for PROTECTED_PREFIXES
// below, not by keeping those routes out of the matcher.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/leaderboard",
  "/settings",
  "/chat",
  "/admin",
  "/corporate",
  "/regulator",
  "/notifications",
  "/provider",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Applied to every response this middleware can return, including the redirect. */
function withSecurityHeaders(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  for (const [key, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  // A fresh nonce per request.
  //
  // Setting the CSP on the *request* headers (not just the response) is the
  // load-bearing part: Next parses the nonce back out of that header and
  // stamps it onto every script it emits, inline bootstrap and chunk alike.
  // Without it a strict script-src blocks hydration entirely.
  //
  // Nothing needs to read the nonce by hand — and nothing should. Passing it
  // to a <Script> explicitly breaks hydration, because browsers blank the
  // `nonce` content attribute after parsing (see the note in layout.tsx).
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Public routes get the nonce + security headers above and nothing else —
  // no Supabase round-trip, since there's no session to check.
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return withSecurityHeaders(response, csp);
  }

  // Fast anonymous short-circuit: with no Supabase auth cookie on the
  // request there can't be a session, so redirect without the network
  // round-trip to Supabase that getUser() would otherwise perform.
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.endsWith("-auth-token"));

  if (!hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return withSecurityHeaders(NextResponse.redirect(url), csp);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Rebuilding the response here drops any header already set on it,
          // so the nonce-carrying request headers must be re-attached.
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Only ever a same-origin path — `nextUrl.pathname` cannot carry a host,
    // so this cannot be turned into an open redirect by a crafted request.
    url.searchParams.set("next", request.nextUrl.pathname);
    return withSecurityHeaders(NextResponse.redirect(url), csp);
  }

  return withSecurityHeaders(response, csp);
}
