-- Kuwana — Supabase Storage setup for provider-uploaded listing images.
-- Paste into Supabase Dashboard → SQL Editor → New query → Run, ONCE per
-- project. Storage buckets/policies live in the `storage` schema, which
-- Prisma migrations never touch — this is the Storage equivalent of
-- schema.sql.
--
-- After running this, set SUPABASE_SERVICE_ROLE_KEY (Project Settings →
-- API → service_role key) in your environment. The app's upload route
-- (POST /api/provider/listings/images) uses it to write objects directly,
-- bypassing Storage RLS the same way Prisma already bypasses Postgres RLS
-- for every other table here — that's why there's no client-writable
-- policy below: every write goes through that one server route, which
-- already checks requireOwnProvider() before touching storage.

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

create policy "Public read access to listing images"
on storage.objects for select
to public
using (bucket_id = 'listing-images');

-- Admin-uploaded advert images (POST /api/admin/adverts/images), same
-- pattern: public read, no client-write policy — every write goes through
-- that one server route, which already checks requireAdmin() first.
insert into storage.buckets (id, name, public)
values ('advert-images', 'advert-images', true)
on conflict (id) do nothing;

create policy "Public read access to advert images"
on storage.objects for select
to public
using (bucket_id = 'advert-images');
