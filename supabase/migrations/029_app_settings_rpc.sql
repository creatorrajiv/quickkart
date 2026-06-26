-- Fix: RLS write policy on app_settings was blocking inserts.
-- Solution: security-definer RPC that verifies admin role, then bypasses RLS.

-- Drop the old broken write policy
drop policy if exists "settings_write_admin" on public.app_settings;

-- Safe RPC — runs as the function owner (bypasses RLS), but still checks role
create or replace function public.set_app_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'permission denied: admin only';
  end if;

  insert into public.app_settings (key, value)
  values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end;
$$;

-- Storage bucket for app assets (logo etc.)
insert into storage.buckets (id, name, public)
values ('app-assets', 'app-assets', true)
on conflict (id) do nothing;

-- Anyone can read app assets (logo shown on login page)
create policy "app_assets_read_all"
  on storage.objects for select
  using (bucket_id = 'app-assets');

-- Only admins can upload/delete
create policy "app_assets_write_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'app-assets' and
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "app_assets_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'app-assets' and
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );
