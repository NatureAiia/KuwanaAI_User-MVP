"use client";

import {
  MessageCircle,
  Wifi,
  Phone,
  Landmark,
  PiggyBank,
  ShieldCheck,
  Car,
  HeartPulse,
  GraduationCap,
  Fuel,
  Zap,
  Pill,
  Smartphone,
  Sparkles,
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
  return pickIcon(categorySlug, attributes, size, className);
}

// Renders the icon directly (rather than returning a component reference to
// render via <Icon />) so every JSX tag below is a statically-known imported
// component — required for react-hooks/static-components to verify identity
// stability, since these icons are chosen dynamically per category/attribute.
function pickIcon(
  categorySlug: string,
  attributes: Record<string, unknown> | undefined,
  size: number,
  className: string | undefined,
) {
  const props = { "aria-hidden": true as const, size, className: `shrink-0 text-accent-teal ${className ?? ""}` };

  // Attribute hint — strongest signal. A listing with a "minutes" attribute
  // is a voice bundle, even if its category is mis-tagged.
  if (attributes) {
    if ("minutes" in attributes || "sms_count" in attributes) return <MessageCircle {...props} />;
    if ("data_amount" in attributes || "data_gb" in attributes) return <Wifi {...props} />;
    if ("interest_rate" in attributes || "monthly_fee" in attributes) return <PiggyBank {...props} />;
    if ("premium_monthly" in attributes) return <ShieldCheck {...props} />;
    if ("term_fees" in attributes) return <GraduationCap {...props} />;
    if ("fare_estimate" in attributes) return <Fuel {...props} />;
    if ("fee_per_transaction" in attributes) return <Zap {...props} />;
    if ("pack_size" in attributes) return <Pill {...props} />;
    if ("device_type" in attributes) return <Smartphone {...props} />;
    if ("plan_type" in attributes) return <Sparkles {...props} />;
  }
  switch (categorySlug) {
    case "data-bundles":
      return <Wifi {...props} />;
    case "voice-sms-bundles":
      return <MessageCircle {...props} />;
    case "savings-accounts":
      return <PiggyBank {...props} />;
    case "current-accounts":
      return <Landmark {...props} />;
    case "motor-insurance":
      return <Car {...props} />;
    case "life-insurance":
      return <ShieldCheck {...props} />;
    case "primary-schools":
    case "secondary-schools":
      return <GraduationCap {...props} />;
    case "ride-fares":
      return <Fuel {...props} />;
    case "prepaid-tokens":
      return <Zap {...props} />;
    case "otc-health-essentials":
      return <Pill {...props} />;
    case "tech-gadgets":
      return <Smartphone {...props} />;
    case "ai-tools-subscriptions":
      return <Sparkles {...props} />;
    case "healthcare":
      return <HeartPulse {...props} />;
    default:
      return <Phone {...props} />;
  }
}
