import { prisma } from "@/lib/prisma";

type AdminAuditAction =
  | "listing_approved"
  | "listing_rejected"
  | "listing_deleted"
  | "provider_linked"
  | "provider_unlinked"
  | "user_role_changed"
  | "llm_model_changed"
  | "advert_created"
  | "advert_updated"
  | "advert_deleted"
  | "scrape_item_approved"
  | "scrape_item_rejected"
  | "scrape_source_created"
  | "corporate_request_approved"
  | "corporate_request_rejected"
  | "corporate_domain_linked"
  | "discount_rule_created"
  | "discount_rule_deleted"
  | "economic_driver_upserted"
  | "economic_driver_deleted"
  | "business_condition_created"
  | "business_condition_updated"
  | "business_condition_deleted"
  | "api_key_created"
  | "api_key_revoked"
  | "listing_created"
  | "provider_created"
  | "scrape_source_updated"
  | "scrape_source_deleted"
  | "social_mention_reviewed"
  | "market_basket_item_created"
  | "market_basket_item_deleted"
  | "investigation_flagged"
  | "investigation_updated"
  | "price_cap_rule_created"
  | "price_cap_rule_updated"
  | "price_cap_rule_deleted"
  | "complaint_promoted"
  | "user_suspended"
  | "user_reactivated";

/**
 * Records who did what to which row — despite the field name, not admin-only:
 * a regulator account opening/updating a case, setting a price cap, or
 * promoting a complaint logs here too (see src/app/api/regulator/*), same as
 * an admin doing the equivalent action from /admin/investigations. One
 * consolidated log for every privileged actor beats two disconnected ones,
 * especially for enforcement actions (investigation_updated's detail carries
 * the outcome — warning/fine/suspension — a regulator recorded).  No FK to
 * the target: an audit entry for listing_deleted has to outlive the listing
 * it's about.
 */
export async function logAdminAction(params: {
  adminEmail: string;
  action: AdminAuditAction;
  targetType:
    | "listing"
    | "provider"
    | "user"
    | "setting"
    | "advert"
    | "scrape_source"
    | "scraped_item"
    | "corporate_request"
    | "discount_rule"
    | "economic_driver"
    | "business_condition"
    | "api_key"
    | "social_mention"
    | "market_basket_item"
    | "investigation"
    | "price_cap_rule"
    | "complaint";
  targetId: string;
  detail: string;
}): Promise<void> {
  await prisma.adminAuditLog.create({ data: params });
}
