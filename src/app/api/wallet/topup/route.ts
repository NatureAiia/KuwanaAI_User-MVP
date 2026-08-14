import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { initiateTransaction } from "@/lib/paynow";

const topUpSchema = z.object({
  amount: z.number().positive().max(5000),
  currency: z.enum(["USD", "ZiG"]),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return privateJson({ error: "Not authenticated" }, { status: 401 });

  const limited = await enforceRateLimit(`wallet-topup:${user.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = topUpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return privateJson({ error: "NEXT_PUBLIC_SITE_URL is not configured" }, { status: 500 });

  const { amount, currency } = parsed.data;
  const reference = `KUWANA-${randomUUID()}`;

  const tx = await prisma.walletTransaction.create({
    data: { userId: user.id, reference, amount, currency },
  });

  const result = await initiateTransaction({
    reference,
    amount,
    currency,
    additionalInfo: "Kuwana wallet top-up",
    returnUrl: `${siteUrl}/wallet/return?ref=${reference}`,
    resultUrl: `${siteUrl}/api/wallet/paynow/webhook`,
    authEmail: user.email ?? "",
  });

  if (!result.ok) {
    await prisma.walletTransaction.update({
      where: { id: tx.id },
      data: { status: "failed", failureReason: result.error },
    });
    return privateJson({ error: result.error }, { status: 502 });
  }

  await prisma.walletTransaction.update({
    where: { id: tx.id },
    data: { status: "pending", pollUrl: result.pollUrl },
  });

  return privateJson({ redirectUrl: result.browserUrl, reference });
}
