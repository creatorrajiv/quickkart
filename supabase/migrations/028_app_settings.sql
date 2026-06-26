-- App-wide settings stored as key/value rows.
-- Readable by everyone (anon), writable only via service role or admin RPC.

create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

alter table public.app_settings enable row level security;

-- Anyone can read settings (needed on login / public pages)
create policy "settings_read_all"
  on public.app_settings for select
  using (true);

-- Only admins can write
create policy "settings_write_admin"
  on public.app_settings for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seed defaults
insert into public.app_settings (key, value) values
  ('app_name',    'QuickKart'),
  ('app_tagline', 'Hyperlocal Delivery')
on conflict (key) do nothing;
