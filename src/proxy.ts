import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /explore is intentionally NOT protected — pre-signup visitors can browse
// read-only (Section 7.1); compare/save/action routes gate client-side.
// The matcher is scoped to exactly these prefixes so the Supabase auth
// round-trip (several hundred ms to several seconds in the proxy, see the
// dev logs) is never paid for public routes like /, /login, /signup,
// /explore or /api/* — those pages authenticate server-side where they
// need to. The patterns are spelled out because Next.js requires the
// `matcher` config to be statically analyzable (no `.map()` over a list).
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/leaderboard/:path*",
    "/settings/:path*",
    "/chat/:path*",
    "/admin/:path*",
    "/corporate/:path*",
    "/regulator/:path*",
    "/notifications/:path*",
    "/provider/:path*",
  ],
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
    return NextResponse.redirect(url);
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
          response = NextResponse.next({ request });
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
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
