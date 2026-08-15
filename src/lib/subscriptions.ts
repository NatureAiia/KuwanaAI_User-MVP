import type { Plan, Role, Subscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The only roles with a plan/subscription concept — provider and admin
 * accounts are internal/business accounts, not payment-gated. Consumer stays
 * self-service/freemium; corporate and regulator are subscription-only —
 * see FREE_PLANS below, each with its own catalog even though every plan is
 * priceCents: 0 for now.
 */
const ELIGIBLE_ROLES = ["consumer", "corporate", "regulator"] as const;
export type EligibleRole = (typeof ELIGIBLE_ROLES)[number];

function isEligibleRole(role: Role): role is EligibleRole {
  return (ELIGIBLE_ROLES as readonly Role[]).includes(role);
}

const FREE_PLANS: Record<EligibleRole, { key: string; name: string }> = {
  consumer: { key: "consumer_free", name: "Free" },
  corporate: { key: "corporate_free", name: "Free" },
  regulator: { key: "regulator_free", name: "Free" },
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Upserts the canonical "<role>_free" plan, creating it on first call rather than requiring a data migration — same self-healing shape as FxRate's live-refresh fallback. */
export async function ensurePlan(role: EligibleRole): Promise<Plan> {
  const def = FREE_PLANS[role];
  return prisma.plan.upsert({
    where: { key: def.key },
    update: {},
    create: { key: def.key, role, name: def.name, priceCents: 0, currency: "USD", features: [] },
  });
}

type SubscriptionWithPlan = Subscription & { plan: Plan };

/** Advances a subscription past its elapsed period by exactly one billing cycle. */
async function rollover(sub: SubscriptionWithPlan): Promise<SubscriptionWithPlan> {
  return prisma.subscription.update({
    where: { id: sub.id },
    data: {
      currentPeriodStart: sub.currentPeriodEnd,
      currentPeriodEnd: addMonths(sub.currentPeriodEnd, sub.plan.billingPeriodMonths),
    },
    include: { plan: true },
  });
}

/**
 * Finds the user's subscription, creating one on their role's free plan if
 * none exists yet, and rolling it forward if its period has already elapsed.
 * Called both by individual feature checks (hasFeature) and in bulk by
 * ensureAllSubscriptions — this is what makes "reset monthly" automatic
 * rather than only happening for accounts someone happens to look up.
 */
export async function getOrCreateSubscription(userId: string, role: EligibleRole): Promise<SubscriptionWithPlan> {
  const existing = await prisma.subscription.findUnique({ where: { userId }, include: { plan: true } });
  if (existing) {
    return existing.currentPeriodEnd <= new Date() ? rollover(existing) : existing;
  }

  const plan = await ensurePlan(role);
  const now = new Date();
  return prisma.subscription.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      planId: plan.id,
      currentPeriodStart: now,
      currentPeriodEnd: addMonths(now, plan.billingPeriodMonths),
    },
    include: { plan: true },
  });
}

/**
 * Backfills every consumer/corporate/regulator user missing a subscription
 * and rolls forward every subscription whose period has elapsed — the
 * monthly-reset cron's job, also called from the admin plans page so it's
 * always complete/accurate on load without waiting for the next cron run.
 */
export async function ensureAllSubscriptions(): Promise<{ created: number; rolled: number }> {
  for (const role of ELIGIBLE_ROLES) {
    await ensurePlan(role);
  }

  const missing = await prisma.user.findMany({
    where: { role: { in: ELIGIBLE_ROLES as unknown as Role[] }, subscription: null },
    select: { id: true, role: true },
  });
  for (const user of missing) {
    await getOrCreateSubscription(user.id, user.role as EligibleRole);
  }

  const due = await prisma.subscription.findMany({
    where: { currentPeriodEnd: { lte: new Date() } },
    include: { plan: true },
  });
  for (const sub of due) {
    await rollover(sub);
  }

  return { created: missing.length, rolled: due.length };
}

/**
 * Whether an account is entitled to a gated feature: a manual admin override
 * (User.allowedFeatures) always wins; otherwise provider/admin accounts are
 * never gated, and consumer/corporate/regulator accounts fall back to their
 * plan's `features` (empty = full access, same convention allowedFeatures
 * already documents). Not called from any route yet — this is the entry
 * point future feature-gated pages will use once real paid packages exist.
 */
export async function hasFeature(userId: string, featureKey: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, allowedFeatures: true } });
  if (!user) return false;
  if (user.allowedFeatures.includes(featureKey)) return true;
  if (!isEligibleRole(user.role)) return true;

  const subscription = await getOrCreateSubscription(userId, user.role);
  return subscription.plan.features.length === 0 || subscription.plan.features.includes(featureKey);
}
