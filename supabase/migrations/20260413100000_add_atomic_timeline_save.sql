create or replace function public.update_timeline_versioned(
  p_timeline_id uuid,
  p_expected_version integer,
  p_config jsonb,
  p_asset_registry jsonb
)
returns table (config_version integer)
language sql
security invoker
set search_path = public
as $$
  update public.timelines
  set
    config = p_config,
    asset_registry = p_asset_registry,
    config_version = timelines.config_version + 1,
    updated_at = timezone('utc', now())
  where timelines.id = p_timeline_id
    and timelines.config_version = p_expected_version
  returning timelines.config_version;
$$;

grant execute on function public.update_timeline_versioned(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function public.update_timeline_versioned(uuid, integer, jsonb, jsonb) to service_role;
