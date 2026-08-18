import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, RATE_LIMITS, clientKey } from "@/lib/rateLimit";
import { initiateExpressCheckout } from "@/lib/paynow";

const expressTopUpSchema = z.object({
  amount: z.number().positive().max(5000),
  currency: z.enum(["USD", "ZiG"]),
  phone: z.string().trim().regex(/^\d{9,15}$/, "Enter a valid mobile number, digits only"),
  method: z.enum(["ecocash", "onemoney", "innbucks"]),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return privateJson({ error: "Not authenticated" }, { status: 401 });

  const limited = await enforceRateLimit(`wallet-topup:${user.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;
  const ipLimited = await enforceRateLimit(`wallet-topup-ip:${clientKey(req)}`, RATE_LIMITS.walletTopupIp);
  if (ipLimited) return ipLimited;

  const parsed = expressTopUpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return privateJson({ error: "NEXT_PUBLIC_SITE_URL is not configured" }, { status: 500 });

  const { amount, currency, phone, method } = parsed.data;
  const reference = `KUWANA-${randomUUID()}`;

  const tx = await prisma.walletTransaction.create({
    data: { userId: user.id, reference, amount, currency },
  });

  try {
    const result = await initiateExpressCheckout({
      reference,
      amount,
      currency,
      additionalInfo: "Kuwana wallet top-up",
      returnUrl: `${siteUrl}/wallet/return?ref=${reference}`,
      resultUrl: `${siteUrl}/api/wallet/paynow/webhook`,
      authEmail: user.email ?? "",
      phone,
      method,
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

    return privateJson({
      reference,
      instructions: result.instructions ?? "Check your phone to authorize the payment.",
    });
  } catch (err) {
    // Same rationale as the web-redirect topup route: a thrown network/timeout
    // error here would otherwise leave the WalletTransaction row stuck in its
    // initial state forever with no explanation.
    console.error("[wallet/topup/express] initiateExpressCheckout threw:", err);
    await prisma.walletTransaction.update({
      where: { id: tx.id },
      data: { status: "failed", failureReason: "Payment gateway request failed unexpectedly." },
    });
    return privateJson({ error: "Something went wrong starting your top-up. Please try again." }, { status: 502 });
  }
}
