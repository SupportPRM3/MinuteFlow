-- MinuteFlow schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run

-- Meetings table (stores full meeting document as JSONB)
create table if not exists meetings (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table meetings enable row level security;

-- Allow all operations (no auth yet — add user scoping later)
create policy "public_all" on meetings
  for all using (true) with check (true);

-- Audio recordings bucket
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

-- Allow all storage operations on the recordings bucket
create policy "recordings_all" on storage.objects
  for all using (bucket_id = 'recordings')
  with check (bucket_id = 'recordings');
