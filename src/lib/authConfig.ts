// Edge-safe: no Prisma, no bcryptjs. Imported by both src/proxy.ts (Edge
// runtime, via next-auth/jwt's getToken) and src/lib/nextAuth.ts (Node
// runtime), so the two can never disagree about the session cookie's shape.
//
// Matches @auth/core's own default cookie naming (see
// node_modules/@auth/core/lib/utils/cookie.js) — kept here as an explicit,
// readable constant rather than trusting an unread third-party default.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token";
