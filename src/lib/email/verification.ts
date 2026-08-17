import { createHmac, hkdfSync, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Signup email verification: mint a six-digit code, mail it, and accept it
 * back once.
 *
 * The code is never stored. What goes in the database is an HMAC-SHA256 of it
 * under a server-held key. That distinction is the whole point of keeping this
 * in our own hands rather than delegating: six digits is 10^6 possibilities,
 * which a plain SHA-256 column surrenders in well under a second on a laptop
 * if the database is ever disclosed. A keyed hash gives an attacker holding a
 * dump nothing to grind against.
 *
 * The message is `userId:email:code`, so a hash is only meaningful in the row
 * it was written for — a code minted for one account cannot be replayed
 * against another, and a code minted before an address change cannot be
 * redeemed after it.
 */

const CODE_DIGITS = 6;

/** Long enough to find the mail, short enough that a leaked code is stale. */
export const CODE_TTL_MINUTES = 10;

/**
 * Wrong guesses tolerated against a single code. Five leaves 999,995 of the
 * 10^6 space unexplored; the per-user send limit is what stops an attacker
 * simply asking for a fresh code and spending another five.
 */
export const MAX_ATTEMPTS = 5;

/**
 * Keys the HMAC. `EMAIL_VERIFICATION_SECRET` if set; otherwise derived from
 * the service-role key, which every real deployment already has.
 *
 * HKDF rather than using the service key directly: the derived key is
 * domain-separated by the `info` string, so this use cannot weaken — or be
 * weakened by — anything else that key is used for.
 */
function verificationKey(): Buffer {
  const secret = process.env.EMAIL_VERIFICATION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    // Only reachable on a deployment that configured SMTP but has no Supabase
    // service key, which cannot serve a request anyway. Failing here is
    // better than silently falling back to an unkeyed hash.
    throw new Error(
      "Email verification needs EMAIL_VERIFICATION_SECRET or SUPABASE_SERVICE_ROLE_KEY to key its code hashes",
    );
  }
  return Buffer.from(hkdfSync("sha256", secret, "", "kuwana:email-verification:v1", 32));
}

export function hashCode(userId: string, email: string, code: string): string {
  return createHmac("sha256", verificationKey())
    .update(`${userId}:${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

/**
 * Case and surrounding whitespace must not decide whether a code matches —
 * mail clients and mobile keyboards both capitalise the first letter of an
 * address, and the hash is over the exact bytes.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * `randomInt` is rejection-sampled, so every code from 000000 to 999999 is
 * equally likely — `Math.random()` would be neither uniform nor unpredictable,
 * and leading zeros survive because this is a string, not a number.
 */
export function mintCode(): string {
  return String(randomInt(10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

export function isValidCodeFormat(code: string): boolean {
  return new RegExp(`^\\d{${CODE_DIGITS}}$`).test(code);
}

/**
 * Issues a fresh code, returning the plaintext for the mailer and nothing
 * else. Any earlier unconsumed code for this user is expired first: leaving
 * several live at once would multiply the attempt budget by the number of
 * times the user pressed resend.
 */
export async function issueVerificationCode(userId: string, email: string): Promise<string> {
  const code = mintCode();
  const normalized = normalizeEmail(email);

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationCode.updateMany({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
    await tx.emailVerificationCode.create({
      data: {
        userId,
        email: normalized,
        codeHash: hashCode(userId, normalized, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
      },
    });
  });

  return code;
}

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many_attempts" | "mismatch" };

/**
 * Checks a submitted code against the newest one issued to this user.
 *
 * Every failure path returns a reason but the caller deliberately collapses
 * most of them at the API boundary — telling an attacker whether a code
 * existed, expired or simply did not match hands them a probe for which
 * addresses are mid-signup.
 */
export async function verifyCode(
  userId: string,
  email: string,
  code: string,
): Promise<VerificationResult> {
  const normalized = normalizeEmail(email);

  const record = await prisma.emailVerificationCode.findFirst({
    where: { userId, email: normalized, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, reason: "no_code" };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const expected = Buffer.from(record.codeHash, "hex");
  const supplied = Buffer.from(hashCode(userId, normalized, code), "hex");
  // Both are 32-byte SHA-256 digests, so the length check can never be what
  // rejects a guess — which is what makes the comparison constant-time in the
  // way that matters. `timingSafeEqual` throws on a length mismatch, so a
  // corrupt stored value must not reach it.
  const matches =
    expected.length === supplied.length && timingSafeEqual(expected, supplied);

  if (!matches) {
    // Incremented before returning, so a client that abandons the request
    // mid-flight still spends the attempt.
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "mismatch" };
  }

  // Single-use, enforced by the `consumedAt: null` filter rather than by
  // reading the row and writing it back: two requests carrying the same
  // correct code race here, and exactly one gets a row count of 1.
  const consumed = await prisma.emailVerificationCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) return { ok: false, reason: "no_code" };

  return { ok: true };
}

/**
 * Whether this signup has ever completed verification — the check
 * /api/onboarding makes before writing a User row, since the row itself is
 * what carries `emailVerifiedAt` and does not exist yet at that point.
 */
export async function hasVerifiedEmail(userId: string, email: string): Promise<boolean> {
  const consumed = await prisma.emailVerificationCode.findFirst({
    where: { userId, email: normalizeEmail(email), consumedAt: { not: null } },
    select: { id: true },
  });
  return consumed !== null;
}

/**
 * How long a spent or lapsed code is kept. Long enough that a signup
 * interrupted for a fortnight can still be finished — hasVerifiedEmail()
 * reads consumed rows, so deleting them promptly would silently un-verify
 * anyone who paused mid-flow — and short enough that this table is not an
 * indefinite archive of who signed up when.
 */
export const RETENTION_DAYS = 30;

/** Called by /api/cron/verification-sweep. */
export async function purgeStaleVerificationCodes(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60_000);
  const { count } = await prisma.emailVerificationCode.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: count };
}
