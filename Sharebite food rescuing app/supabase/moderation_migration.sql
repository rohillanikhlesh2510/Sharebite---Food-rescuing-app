-- =========================================================
-- SHAREBITE — IMAGE MODERATION SCHEMA MIGRATION
-- Run this AFTER the main migration.sql
-- Safe to re-run (idempotent guards)
-- =========================================================

-- ── Enum: moderation_status ───────────────────────────────────────────────────

do $$ begin
  create type public.moderation_status as enum (
    'pending',
    'approved',
    'rejected',
    'manual_review'
  );
exception when duplicate_object then null; end $$;

-- ── food_moderation table ─────────────────────────────────────────────────────

create table if not exists public.food_moderation (
  id                  uuid primary key default gen_random_uuid(),
  food_post_id        uuid references public.food_listings(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- Image info
  image_url           text not null,
  image_hash          text,          -- pHash/average-hash for duplicate detection

  -- Moderation decision
  moderation_status   public.moderation_status not null default 'pending',
  ai_decision         text,          -- 'approved' | 'rejected' | 'manual_review'

  -- AI analysis fields
  is_food             boolean,
  is_spam             boolean,
  is_screenshot       boolean,
  is_advertisement    boolean,
  is_duplicate        boolean,
  quality_score       numeric(4,3),   -- 0.000 to 1.000
  confidence          numeric(4,3),   -- 0.000 to 1.000
  ai_reason           text,           -- human-readable AI reason
  ai_labels           text[],         -- top labels from Vision API
  duplicate_of        uuid references public.food_moderation(id), -- if is_duplicate

  -- Admin override
  admin_override_by   uuid references auth.users(id),
  admin_override_at   timestamptz,
  admin_notes         text,

  -- Timestamps
  moderated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Add moderation columns to food_listings ───────────────────────────────────

alter table public.food_listings
  add column if not exists moderation_status text not null default 'pending',
  add column if not exists image_hash        text;

-- ── updated_at trigger ────────────────────────────────────────────────────────

-- Reuse existing set_updated_at function if it exists
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists food_moderation_updated_at on public.food_moderation;
create trigger food_moderation_updated_at
  before update on public.food_moderation
  for each row execute function public.set_updated_at();

-- ── Index for fast hash lookup (duplicate detection) ──────────────────────────

create index if not exists idx_food_moderation_image_hash
  on public.food_moderation(image_hash)
  where image_hash is not null;

create index if not exists idx_food_moderation_status
  on public.food_moderation(moderation_status);

create index if not exists idx_food_moderation_user
  on public.food_moderation(user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.food_moderation enable row level security;

drop policy if exists "moderation_user_read_own" on public.food_moderation;
drop policy if exists "moderation_user_insert" on public.food_moderation;
drop policy if exists "moderation_admin_all" on public.food_moderation;

-- Users can only read their own moderation records
create policy "moderation_user_read_own" on public.food_moderation
  for select using (user_id = auth.uid());

-- Users can insert their own moderation request
create policy "moderation_user_insert" on public.food_moderation
  for insert with check (user_id = auth.uid());

-- Admins can read and update all records
create policy "moderation_admin_all" on public.food_moderation
  for all
  to authenticated
  using (public.get_auth_user_role() = 'admin');

-- ── View: pending moderation queue (for admin) ────────────────────────────────

create or replace view public.moderation_queue as
select
  fm.*,
  p.full_name as user_name,
  p.email as user_email,
  fl.title as food_title,
  fl.category as food_category
from public.food_moderation fm
left join public.profiles p on p.id = fm.user_id
left join public.food_listings fl on fl.id = fm.food_post_id
order by fm.created_at desc;

-- ── Enable Realtime ───────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.food_moderation;
