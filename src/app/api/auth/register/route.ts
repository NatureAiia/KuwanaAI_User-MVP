import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { registerSchema } from "@/lib/authSchema";
import { enforceRateLimit, clientKey, RATE_LIMITS } from "@/lib/rateLimit";

/**
 * Creates the `users` row (with its password hash) ahead of onboarding.
 *
 * Split from /api/onboarding deliberately: onboarding's corporate/regulator
 * domain checks (src/lib/orgVerification.ts) key off the *authenticated
 * session's* email specifically to prevent a spoofed request-body email —
 * folding registration into that one atomic call would mean taking the email
 * from the body instead, breaking that boundary. This route creates the
 * account; the client then signs in with it before ever calling onboarding.
 *
 * `onboardingCompletedAt` is left null here — set later by /api/onboarding on
 * success, so an abandoned signup (closed mid-wizard) is distinguishable from
 * a real, completed account in admin/leaderboard views.
 */
export async function POST(req: Request) {
  const limited = await enforceRateLimit(`register:${clientKey(req)}`, RATE_LIMITS.publicWrite);
  if (limited) return limited;

  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) {
    return privateJson({ error: parsed.error.flatten() }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  // Fits onboardingSchema's username charset (^[a-zA-Z0-9_]+$, 3-20 chars)
  // and is unique by construction — /api/onboarding's upsert overwrites it
  // with the user's real chosen handle once they complete the wizard.
  const id = randomUUID();
  const placeholderUsername = `user_${id.replace(/-/g, "").slice(0, 12)}`;

  try {
    await prisma.user.create({
      // consentAccepted was validated as a required `z.literal(true)` above —
      // this is the server-side stamp of that gate (see the `consentAcceptedAt`
      // field comment on the User model), not just a UI checkbox.
      data: { id, email, username: placeholderUsername, passwordHash, consentAcceptedAt: new Date() },
    });
  } catch (err) {
    // The unique constraint, not a pre-check findUnique — a pre-check would
    // be both a TOCTOU race and an account-existence oracle.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return privateJson({ error: "This email can only be used once." }, { status: 409 });
    }
    console.error("[auth/register] failed to create account:", err);
    return privateJson({ error: "Something went wrong creating your account. Please try again." }, { status: 500 });
  }

  return privateJson({ ok: true });
}
