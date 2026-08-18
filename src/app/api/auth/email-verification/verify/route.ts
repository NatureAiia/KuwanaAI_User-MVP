import { z } from "zod";
import { auth } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { clientKey, enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isMailerConfigured } from "@/lib/email/mailer";
import { MAX_ATTEMPTS, verifyCode } from "@/lib/email/verification";

/**
 * Accepts a signup verification code.
 *
 * Authenticates against the Auth.js session directly rather than through
 * requireUser(), for the same reason as the send route: every caller here is
 * unverified, which is precisely what requireUser() refuses.
 */

const bodySchema = z.object({
  // Bounded before it reaches the hash so a caller cannot make us HMAC a
  // megabyte per request. `regex` rather than `length` alone: a non-numeric
  // body should never have been minted, so it is rejected without a database
  // read and without spending one of the code's five attempts.
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) {
    return privateJson({ error: "Not authenticated" }, { status: 401 });
  }

  const perUser = await enforceRateLimit(`verify-code:${user.id}`, RATE_LIMITS.emailVerificationVerify);
  if (perUser) return perUser;
  const perIp = await enforceRateLimit(`verify-code-ip:${clientKey(req)}`, RATE_LIMITS.emailVerificationVerify);
  if (perIp) return perIp;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return privateJson({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  if (!isMailerConfigured()) {
    // Nothing was ever sent, so nothing can be verified. Treated as "not
    // required" rather than as a failure so a deployment without SMTP cannot
    // be left with users stuck at a code screen.
    return privateJson({ verified: false, verificationRequired: false });
  }

  const result = await verifyCode(user.id, user.email, parsed.data.code);

  if (!result.ok) {
    // `too_many_attempts` is told apart from the rest deliberately: it is the
    // one state where retrying is futile and the user needs a new code, so
    // hiding it would strand them. The others collapse into one message —
    // distinguishing "expired" from "no code was ever issued" from "wrong
    // digits" tells an attacker which addresses are mid-signup.
    const message =
      result.reason === "too_many_attempts"
        ? `That code has been entered incorrectly ${MAX_ATTEMPTS} times. Request a new one.`
        : "That code isn't right, or it has expired. Check the latest email or request a new code.";
    return privateJson({ error: message, reason: result.reason }, { status: 400 });
  }

  // Stamps the User row when one already exists. During a first-time signup
  // it does not yet — onboarding creates it, and reads the consumed code back
  // via hasVerifiedEmail() to decide what to stamp it with. updateMany rather
  // than update so the missing row is a no-op instead of a thrown P2025.
  await prisma.user.updateMany({
    where: { id: user.id, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });

  return privateJson({ verified: true });
}
