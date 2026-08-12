"use client";

import {
  MessageCircle,
  Wifi,
  Phone,
  Landmark,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Car,
  HeartPulse,
  GraduationCap,
  Fuel,
  Zap,
  Pill,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Small icon that sits next to a listing's title to hint at its tier/category.
 * Pure presentational — picks the icon based on the category slug, falling
 * back to attribute keys when the slug is unhelpfully generic.
 *
 * Examples (per the dashboard brief):
 *   - Voice & SMS bundles  -> MessageCircle (the "Telecel Chat" chat bubble)
 *   - Data bundles         -> Wifi
 *   - Savings accounts     -> PiggyBank
 *   - Current accounts     -> Landmark
 *   - Motor insurance      -> Car
 *   - Life insurance       -> ShieldCheck
 *   - Schools              -> GraduationCap
 *   - Ride fares           -> Fuel
 *   - Prepaid tokens       -> Zap
 *   - Pharmacy             -> Pill
 *   - Tech & Gadgets       -> Smartphone
 *   - AI Tools             -> Sparkles
 */
export function CategoryBadge({
  categorySlug,
  attributes,
  size = 14,
  className,
}: {
  categorySlug: string;
  attributes?: Record<string, unknown>;
  size?: number;
  className?: string;
}) {
  const Icon = pickIcon(categorySlug, attributes);
  return (
    <Icon
      aria-hidden="true"
      size={size}
      className={`shrink-0 text-accent-teal ${className ?? ""}`}
    />
  );
}

function pickIcon(categorySlug: string, attributes?: Record<string, unknown>): LucideIcon {
  // Attribute hint — strongest signal. A listing with a "minutes" attribute
  // is a voice bundle, even if its category is mis-tagged.
  if (attributes) {
    if ("minutes" in attributes || "sms_count" in attributes) return MessageCircle;
    if ("data_amount" in attributes || "data_gb" in attributes) return Wifi;
    if ("interest_rate" in attributes || "monthly_fee" in attributes) return PiggyBank;
    if ("premium_monthly" in attributes) return ShieldCheck;
    if ("term_fees" in attributes) return GraduationCap;
    if ("fare_estimate" in attributes) return Fuel;
    if ("fee_per_transaction" in attributes) return Zap;
    if ("pack_size" in attributes) return Pill;
    if ("device_type" in attributes) return Smartphone;
    if ("plan_type" in attributes) return Sparkles;
  }
  switch (categorySlug) {
    case "data-bundles":
      return Wifi;
    case "voice-sms-bundles":
      return MessageCircle;
    case "savings-accounts":
      return PiggyBank;
    case "current-accounts":
      return Landmark;
    case "motor-insurance":
      return Car;
    case "life-insurance":
      return ShieldCheck;
    case "primary-schools":
    case "secondary-schools":
      return GraduationCap;
    case "ride-fares":
      return Fuel;
    case "prepaid-tokens":
      return Zap;
    case "otc-health-essentials":
      return Pill;
    case "tech-gadgets":
      return Smartphone;
    case "ai-tools-subscriptions":
      return Sparkles;
    case "healthcare":
      return HeartPulse;
    default:
      return Phone;
  }
}
