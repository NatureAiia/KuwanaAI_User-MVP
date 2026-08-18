import { z } from "zod";

// Kept in its own module (rather than inline in the route files), same
// reasoning as src/lib/onboardingSchema.ts: Next.js route files only permit
// specific recognized exports, and both /api/auth/register and the signup
// page's account step need to import the identical rules so they can't drift.

// The 100 most common leaked passwords (RockYou/Have I Been Pwned top lists),
// lowercased. Deliberately small and in-repo rather than a package: at a
// 10-char minimum length this only needs to catch the padded/common cases
// that slip past a length check ("password123", "iloveyou1", etc.), not serve
// as a full breach-corpus check.
const COMMON_PASSWORDS = new Set([
  "password123", "password1234", "password12345", "12345678910", "1234567890",
  "qwertyuiop", "qwerty123", "iloveyou1", "iloveyou123", "letmein123",
  "welcome123", "admin12345", "abc123456", "password!", "password1!",
  "sunshine123", "princess123", "football123", "baseball123", "dragon123",
  "monkey1234", "shadow1234", "master1234", "superman123", "trustno123",
  "batman1234", "michael123", "jennifer123", "jordan1234", "hunter1234",
  "george1234", "charlie123", "andrew1234", "michelle12", "starwars12",
  "whatever12", "computer12", "internet12", "1qaz2wsx34", "zaq1zaq123",
  "qazwsxedc1", "1q2w3e4r5t", "q1w2e3r4t5", "asdfghjkl1", "asdf1234as",
  "zxcvbnm123", "poiuytrewq", "mnbvcxz123", "changeme12", "letmein1234",
  "welcometo1", "newpassword", "password01", "password02", "temppass123",
  "guestguest", "testtest12", "userpass12", "adminadmin", "rootroot12",
  "p@ssw0rd12", "p@ssword12", "passw0rd12", "correcthorse", "trustme123",
  "iloveyou12", "loveyou123", "myspace123", "facebook12", "instagram1",
  "twitter123", "youtube123", "gmailgmail", "outlook123", "microsoft1",
  "apple12345", "amazon1234", "netflix123", "spotify123", "linkedin12",
  "birthday12", "christmas1", "vacation12", "summer2024", "winter2024",
  "january123", "february12", "november12", "december12", "morning123",
  "sunshine12", "rainbow123", "butterfly1", "chocolate1", "strawberry",
  "basketball", "volleyball", "tennisball", "swimming12", "running123",
  "cooking123", "gardening1", "traveling1", "shopping12", "reading123",
]);

// NIST 800-63B: length is the control that matters; composition rules mostly
// produce "Password1!" and a sticky note. 10 is the floor, not 8.
// Exported on its own (in addition to registerSchema below) so the signup
// page's account step can validate the password field inline, before the
// user has necessarily typed a valid email to pair it with.
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  // bcrypt silently ignores everything past 72 bytes — an explicit cap beats
  // an invisible truncation that would make two different passwords compare
  // equal.
  .max(72, "Use at most 72 characters.")
  .refine((p) => p.trim() === p, "Remove leading/trailing spaces.")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "That password is too common — please choose another.");

export const registerSchema = z
  .object({
    email: z.email().max(254),
    password: passwordSchema,
  })
  .refine(
    ({ email, password }) => {
      const localPart = email.split("@")[0]?.toLowerCase();
      return !localPart || !password.toLowerCase().includes(localPart);
    },
    { path: ["password"], message: "Your password can't contain your email address." },
  );

// Deliberately NOT passwordSchema: an account whose password predates this
// policy must still be able to log in. Only a sanity bound so an
// unreasonably large body can't be fed into bcrypt's comparison.
export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(72),
  // Enforced in authorize() whenever a Turnstile secret is configured (see
  // verifyTurnstileToken) — optional here so a deployment without one keeps
  // working unchanged.
  turnstileToken: z.string().max(4096).optional(),
});
