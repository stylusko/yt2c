create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '새 프로젝트',
  project_type text not null default 'video',
  source_type text not null default 'youtube',
  brand text not null default '',
  page_variant text not null default 'default',
  thumbnail_url text not null default '',
  card_count integer not null default 0,
  latest_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists projects_user_updated_idx
  on public.projects(user_id, updated_at desc)
  where archived_at is null;

create table if not exists public.generated_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  output_type text not null default 'cards',
  status text not null default 'completed',
  title text not null default '',
  thumbnail_url text not null default '',
  files jsonb not null default '[]'::jsonb,
  card_count integer not null default 0,
  source_hash text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists generated_outputs_project_created_idx
  on public.generated_outputs(project_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.generated_outputs enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "projects select own" on public.projects;
create policy "projects select own" on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists "projects insert own" on public.projects;
create policy "projects insert own" on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects update own" on public.projects;
create policy "projects update own" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "generated outputs select own" on public.generated_outputs;
create policy "generated outputs select own" on public.generated_outputs
  for select using (auth.uid() = user_id);

drop policy if exists "generated outputs insert own" on public.generated_outputs;
create policy "generated outputs insert own" on public.generated_outputs
  for insert with check (auth.uid() = user_id);
