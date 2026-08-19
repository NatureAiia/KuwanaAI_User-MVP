-- Extends the corporate/provider/regulator signup wizard into a real
-- multi-section "application": a labeled document list, a tailored per-role
-- Json blob of application fields, and three plain declaration booleans a
-- future admin review UI will want to query directly.
--
-- "verification_document_urls" (TEXT[], added by 20260819000000) is
-- deliberately NOT dropped or renamed here even though
-- "verification_documents" (JSONB) replaces it going forward: that prior
-- migration is already committed at this same HEAD, and there is no way from
-- this environment (no reachable database — see the same situation noted for
-- earlier migrations) to confirm whether it has already been deployed
-- against a database holding real applicant rows. Adding the new columns
-- alongside the old one is additive and safe either way; the old column can
-- be dropped in its own later migration once that's confirmed. Nothing in
-- the application writes to "verification_document_urls" anymore.

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "verification_documents" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "application_details" JSONB,
  ADD COLUMN "accurate_info_declared" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "data_protection_compliance_declared" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "authorized_to_act_declared" BOOLEAN NOT NULL DEFAULT false;
