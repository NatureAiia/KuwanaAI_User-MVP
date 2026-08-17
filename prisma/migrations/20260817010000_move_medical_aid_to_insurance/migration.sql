-- Medical aid plans moved from the (hidden) Healthcare sector into
-- Insurance in prisma/seed.ts. Re-seeding creates a fresh "medical-aid-plans"
-- category under Insurance's sectorId (a different sectorId than the old
-- Healthcare-scoped one, so it doesn't collide) — this migration just
-- removes the now-orphaned Healthcare-scoped category so stale/duplicate
-- data doesn't linger. Cascades to its attribute schema and listings (and,
-- from there, listing price history) via the existing onDelete: Cascade
-- relations in schema.prisma. A no-op if the category was never seeded.
DELETE FROM "categories"
WHERE "slug" = 'medical-aid-plans'
  AND "sector_id" = (SELECT "id" FROM "sectors" WHERE "slug" = 'healthcare');
