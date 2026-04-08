-- ═══════════════════════════════════════════════════════════════
-- Storage buckets + policies
-- Buckets:
-- - documents
-- - property-images
-- Path convention (recommended):
-- - documents/{owner_id}/...
-- - property-images/{owner_id}/...
-- ═══════════════════════════════════════════════════════════════

-- Buckets (idempotent)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', false)
on conflict (id) do nothing;

-- Policies on storage.objects
-- Note: storage.objects is in schema "storage"
-- We scope access to folders prefixed with auth.uid().

-- DOCUMENTS bucket
drop policy if exists "documents_read_own" on storage.objects;
create policy "documents_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "documents_insert_own" on storage.objects;
create policy "documents_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "documents_update_own" on storage.objects;
create policy "documents_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and name like (auth.uid()::text || '/%')
)
with check (
  bucket_id = 'documents'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "documents_delete_own" on storage.objects;
create policy "documents_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and name like (auth.uid()::text || '/%')
);

-- PROPERTY IMAGES bucket
drop policy if exists "property_images_read_own" on storage.objects;
create policy "property_images_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-images'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "property_images_insert_own" on storage.objects;
create policy "property_images_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-images'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "property_images_update_own" on storage.objects;
create policy "property_images_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'property-images'
  and name like (auth.uid()::text || '/%')
)
with check (
  bucket_id = 'property-images'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "property_images_delete_own" on storage.objects;
create policy "property_images_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-images'
  and name like (auth.uid()::text || '/%')
);

