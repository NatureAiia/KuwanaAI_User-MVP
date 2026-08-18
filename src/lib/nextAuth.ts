import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/authSchema";
import { enforceRateLimit, clientKey, RATE_LIMITS } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { SESSION_MAX_AGE } from "@/lib/authConfig";

// A real bcrypt hash (cost 12) of an arbitrary fixed string, generated once
// and pasted in — never computed at import time (that would cost ~150ms on
// every cold start). Compared against on every authorize() call where the
// email lookup misses, so a request for an unknown email takes the same time
// as one for a known email with a wrong password. Without this, response
// timing alone reveals whether an email is registered.
const DUMMY_HASH = "$2b$12$Ep9ES3TLpLLYst9e4OuWKugkcVv/gl7p7e6CVPfWSFtyEWU.Nbf1S";

class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

class TooManyAttemptsError extends CredentialsSignin {
  code = "too_many_attempts";
}

class CaptchaError extends CredentialsSignin {
  code = "captcha_failed";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  // No public ingress hostname is fixed ahead of time on the k3s target (and
  // Vercel already sets this implicitly) — trusting the request's own Host
  // header is what lets one config work correctly on both deploy targets.
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, turnstileToken: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new InvalidCredentialsError();
        const email = parsed.data.email.toLowerCase();

        // Keyed by IP+email so one guessed account can't be locked out from
        // other IPs, and one IP can't be used to grind through many accounts
        // without also tripping this per-email half of the key.
        const limited = await enforceRateLimit(`login:${clientKey(request)}:${email}`, RATE_LIMITS.login);
        if (limited) throw new TooManyAttemptsError();

        // Restores the check Supabase used to run (`signInWithPassword`'s
        // captchaToken option) — Auth.js's Credentials provider has no
        // built-in equivalent, so it's verified explicitly here, before ever
        // touching the database. No-ops entirely when TURNSTILE_SECRET_KEY is
        // unset (see verifyTurnstileToken), so a deployment without one keeps
        // working unchanged.
        const captcha = await verifyTurnstileToken(parsed.data.turnstileToken, clientKey(request));
        if (!captcha.ok) throw new CaptchaError();

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, passwordHash: true },
        });

        // Always compare, even on a lookup miss, against the fixed dummy
        // hash — see DUMMY_HASH above. Returning early on `!user` would leak
        // account existence through response timing (bcrypt at cost 12 is
        // ~100-250ms, trivially measurable).
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user?.passwordHash || !ok) throw new InvalidCredentialsError();

        // Deliberately not checking accountStatus here — see requireUser()
        // in src/lib/auth.ts, which is where suspension is enforced on every
        // request (a JWT claim can't be revoked mid-session, so baking
        // suspension in here would only ever be checked once, at login).
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // Deliberately only sub/email. No role, no accountStatus — both are
      // live Prisma reads elsewhere (getUserRole, requireUser) specifically
      // because a JWT claim would go stale for the life of the token (up to
      // SESSION_MAX_AGE): an admin promotion/demotion or a suspension
      // wouldn't take effect until the token expired.
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.email) session.user.email = token.email;
      return session;
    },
  },
});
