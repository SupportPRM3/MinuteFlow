-- MinuteFlow schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run

-- Meetings table (stores full meeting document as JSONB)
create table if not exists meetings (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now()
);

-- Audio recordings bucket
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

-- ── Multi-user migration ────────────────────────────────────────────────
-- Wipes existing placeholder data (there was no real auth before this, so
-- every row/file belonged to a fake single user) so every remaining row can
-- get a real owner.
-- Note: recordings bucket contents can't be wiped via raw SQL (Supabase
-- blocks direct DELETE on storage.objects) — clear it via the Storage tab in
-- the dashboard, or it's a no-op anyway since old files don't live under any
-- {user_id}/ folder and become unreachable under the new policies below.
delete from meetings;

alter table meetings add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table meetings alter column user_id set not null;

alter table meetings enable row level security;

drop policy if exists "public_all" on meetings;
drop policy if exists "meetings_select_own" on meetings;
drop policy if exists "meetings_insert_own" on meetings;
drop policy if exists "meetings_update_own" on meetings;
drop policy if exists "meetings_delete_own" on meetings;

create policy "meetings_select_own" on meetings
  for select using (auth.uid() = user_id);
create policy "meetings_insert_own" on meetings
  for insert with check (auth.uid() = user_id);
create policy "meetings_update_own" on meetings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meetings_delete_own" on meetings
  for delete using (auth.uid() = user_id);

-- Recordings bucket: objects are stored under a `{user_id}/{meetingId}.{ext}`
-- path, so scope access to each user's own folder.
drop policy if exists "recordings_all" on storage.objects;
drop policy if exists "recordings_select_own" on storage.objects;
drop policy if exists "recordings_insert_own" on storage.objects;
drop policy if exists "recordings_update_own" on storage.objects;
drop policy if exists "recordings_delete_own" on storage.objects;

create policy "recordings_select_own" on storage.objects
  for select using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recordings_insert_own" on storage.objects
  for insert with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recordings_update_own" on storage.objects
  for update using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recordings_delete_own" on storage.objects
  for delete using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Zoom integration (per-user OAuth tokens) ────────────────────────────
-- RLS is enabled with NO policies, which means default-deny for both the
-- anon and authenticated roles. Only the service-role client (supabaseAdmin)
-- bypasses RLS and can read/write this table — OAuth tokens and the
-- host-email→user mapping used to resolve incoming webhooks must never be
-- reachable from the browser, even via a "select own row" policy.
create table if not exists zoom_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  zoom_user_id text not null,
  zoom_account_id text,
  zoom_email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text,
  connected_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists zoom_connections_email_idx on zoom_connections (zoom_email);

alter table zoom_connections enable row level security;
