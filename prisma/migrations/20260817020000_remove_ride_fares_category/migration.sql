-- Transport is buses only now (see prisma/seed.ts's new "bus-fares"
-- category) — the old ride-hailing "ride-fares" category (Vaya/inDrive/
-- Hwindi) is no longer seeded, so remove it rather than leave it dangling.
-- Cascades to its attribute schema and listings via the existing
-- onDelete: Cascade relations in schema.prisma. No-op if already removed.
DELETE FROM "categories"
WHERE "slug" = 'ride-fares'
  AND "sector_id" = (SELECT "id" FROM "sectors" WHERE "slug" = 'transport');
