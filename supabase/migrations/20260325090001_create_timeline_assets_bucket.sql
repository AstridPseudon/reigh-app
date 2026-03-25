insert into storage.buckets (id, name, public)
values ('timeline-assets', 'timeline-assets', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "timeline_assets_select" on storage.objects;
create policy "timeline_assets_select"
  on storage.objects
  for select
  using (
    bucket_id = 'timeline-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "timeline_assets_insert" on storage.objects;
create policy "timeline_assets_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'timeline-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "timeline_assets_update" on storage.objects;
create policy "timeline_assets_update"
  on storage.objects
  for update
  using (
    bucket_id = 'timeline-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'timeline-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "timeline_assets_delete" on storage.objects;
create policy "timeline_assets_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'timeline-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
