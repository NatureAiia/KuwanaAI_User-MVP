import { prisma } from "@/lib/prisma";
import { pollTransactionStatus } from "@/lib/paynow";
import { applyPaynowStatusUpdate } from "@/lib/wallet";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  paid: { title: "Payment received", body: "Your wallet balance has been updated." },
  cancelled: { title: "Payment cancelled", body: "You cancelled the payment on Paynow — no charge was made." },
  failed: { title: "Payment failed", body: "Something went wrong initiating this payment." },
  pending: { title: "Still processing", body: "Paynow hasn't confirmed this payment yet. Check back shortly." },
};

export default async function WalletReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  let tx = ref ? await prisma.walletTransaction.findUnique({ where: { reference: ref } }) : null;

  // The webhook is the source of truth, but the browser return can beat it —
  // nudge with one poll so this page doesn't show a stale "pending" for a
  // payment Paynow already settled.
  if (tx && tx.status === "pending" && tx.pollUrl) {
    const polled = await pollTransactionStatus(tx.pollUrl);
    if (polled) {
      await applyPaynowStatusUpdate(tx, { status: polled.status, paynowreference: polled.paynowReference });
      tx = await prisma.walletTransaction.findUnique({ where: { id: tx.id } });
    }
  }

  const copy = STATUS_COPY[tx?.status ?? "failed"] ?? STATUS_COPY.failed!;

  return (
    <div className="mx-auto flex max-w-[480px] flex-1 flex-col justify-center px-5 py-8">
      <Card>
        <h1 className="font-display text-[20px] font-bold">{copy.title}</h1>
        <p className="mt-2 text-[14px] text-text-secondary">{copy.body}</p>
        {tx && (
          <p className="mt-3 text-[12px] text-text-muted">
            Reference {tx.reference} — {tx.currency} {tx.amount.toString()}
          </p>
        )}
        <LinkButton href="/wallet" className="mt-5">
          Back to wallet
        </LinkButton>
      </Card>
    </div>
  );
}
