import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { privateJson } from "@/lib/apiResponse";
import { clientKey, enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isMailerConfigured, sendMail } from "@/lib/email/mailer";
import { verificationEmail } from "@/lib/email/templates";
import { issueVerificationCode } from "@/lib/email/verification";

/**
 * Mails a fresh signup verification code to the address on the caller's own
 * session.
 *
 * NOT `requireUser()`, and that is the whole subtlety of this route. Anyone
 * hitting it is by definition unverified, and requireUser() rejects exactly
 * that — routing this through it would make the endpoint that fixes the state
 * unreachable from the state it fixes. So it authenticates directly against
 * the Supabase session instead, which is still a real server-side check: the
 * cookie is httpOnly and signed, and the address is read from the session
 * rather than the request body, so a caller cannot aim a code at somebody
 * else's inbox.
 */

// Present but ignored for the destination — see above. Parsed anyway so an
// unexpected body shape is a 400 rather than silently tolerated.
const bodySchema = z.object({}).strict().optional();

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return privateJson({ error: "Not authenticated" }, { status: 401 });
  }

  // Two keys, because either alone is bypassable: per-user stops one account
  // hammering resend, and per-IP stops a farm of throwaway accounts doing the
  // same thing from one machine.
  const perUser = await enforceRateLimit(`verify-send:${user.id}`, RATE_LIMITS.emailVerificationSend);
  if (perUser) return perUser;
  const perIp = await enforceRateLimit(`verify-send-ip:${clientKey(req)}`, RATE_LIMITS.emailVerificationSend);
  if (perIp) return perIp;

  const parsed = bodySchema.safeParse(await req.json().catch(() => undefined));
  if (!parsed.success) {
    return privateJson({ error: "Unexpected request body" }, { status: 400 });
  }

  // No mailer on this deployment means verification is not in force at all
  // (see mailer.ts). Reporting that plainly lets the client skip the code
  // step rather than presenting a box for a mail that will never arrive.
  if (!isMailerConfigured()) {
    return privateJson({ sent: false, verificationRequired: false });
  }

  const code = await issueVerificationCode(user.id, user.email);

  try {
    await sendMail({ to: user.email, ...verificationEmail(code) });
  } catch (err) {
    // The code is already stored, so a retry mints a new one rather than
    // resurrecting this one. Logged without the code in it — server logs are
    // read by more people than should be able to complete somebody's signup.
    console.error("[email-verification] send failed:", err);
    // `verificationRequired: true` stated even on the failure path — the
    // client uses it to decide whether to show the code screen, and a
    // deployment that has a mailer still requires verification even when this
    // particular send did not get through.
    return privateJson(
      {
        error: "We couldn't send your verification code. Please try again in a moment.",
        verificationRequired: true,
      },
      { status: 502 },
    );
  }

  return privateJson({ sent: true, verificationRequired: true });
}
