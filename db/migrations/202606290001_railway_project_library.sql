create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google',
  provider_account_id text not null,
  email text not null,
  name text not null default '',
  image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_account_id),
  unique (email)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  title text not null,
  project_type text not null default 'video',
  source_type text not null default 'youtube',
  brand text not null default '',
  page_variant text not null default 'default',
  thumbnail_url text not null default '',
  card_count integer not null default 0,
  latest_snapshot jsonb not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_updated_idx
  on projects(user_id, updated_at desc)
  where archived_at is null;

create table if not exists generated_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
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
  on generated_outputs(project_id, created_at desc);

create table if not exists shared_projects (
  id text primary key,
  data text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_projects_updated_idx
  on shared_projects(updated_at desc);
