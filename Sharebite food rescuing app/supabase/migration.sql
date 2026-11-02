-- =========================================================
-- SHAREBITE DATABASE FOUNDATION — v2
-- Supabase / PostgreSQL
-- Run this in Supabase SQL Editor → New Query
-- Safe to run multiple times (idempotent)
-- =========================================================

-- Clean up existing tables to ensure clean recreation with correct columns
drop table if exists public.reports cascade;
drop table if exists public.impact_events cascade;
drop table if exists public.notifications cascade;
drop table if exists public.pickup_events cascade;
drop table if exists public.partners cascade;
drop table if exists public.favorites cascade;
drop table if exists public.reservations cascade;
drop table if exists public.donations cascade;
drop table if exists public.food_listings cascade;
drop table if exists public.profiles cascade;

create extension if not exists pgcrypto;


-- =========================================================
-- ENUMS
-- =========================================================

do $$
begin
  create type public.user_role as enum (
    'donor',
    'receiver',
    'volunteer',
    'ngo',
    'partner',
    'admin'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.food_status as enum (
    'available',
    'reserved',
    'partially_reserved',
    'picked_up',
    'completed',
    'expired',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.reservation_status as enum (
    'pending',
    'confirmed',
    'ready_for_pickup',
    'picked_up',
    'completed',
    'cancelled',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_type as enum (
    'reservation_created',
    'reservation_confirmed',
    'pickup_ready',
    'pickup_completed',
    'donation_created',
    'donation_completed',
    'listing_expiring',
    'partner_verified',
    'system'
  );
exception
  when duplicate_object then null;
end $$;

-- =========================================================
-- PROFILES
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role public.user_role not null default 'receiver',
  bio text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  is_verified boolean not null default false,
  total_donations integer not null default 0,
  total_rescues integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- FOOD LISTINGS
-- =========================================================

create table if not exists public.food_listings (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'Other',
  food_type text not null default 'veg'
    check (food_type in ('veg', 'non_veg', 'vegan', 'other')),
  servings integer not null check (servings > 0),
  available_servings integer not null check (available_servings >= 0),
  image_url text,
  pickup_address text,
  city text,
  latitude double precision,
  longitude double precision,
  available_from timestamptz not null default now(),
  available_until timestamptz not null,
  status public.food_status not null default 'available',
  is_urgent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_availability check (available_until > available_from),
  constraint valid_available_servings check (available_servings <= servings)
);

-- =========================================================
-- DONATIONS
-- =========================================================

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  food_listing_id uuid not null references public.food_listings(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  servings integer not null check (servings > 0),
  status text not null default 'active'
    check (status in ('active','partially_rescued','rescued','completed','cancelled','expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- =========================================================
-- RESERVATIONS
-- =========================================================

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  food_listing_id uuid not null references public.food_listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  servings integer not null check (servings > 0),
  status public.reservation_status not null default 'pending',
  pickup_time timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- FAVORITES
-- =========================================================

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_listing_id uuid not null references public.food_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, food_listing_id)
);

-- =========================================================
-- PARTNERS
-- =========================================================

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete cascade,
  organization_name text not null,
  organization_type text not null default 'other'
    check (organization_type in ('restaurant','hostel','ngo','community_kitchen','farmer','organization','other')),
  description text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  logo_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PICKUP EVENTS
-- =========================================================

create table if not exists public.pickup_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  performed_by uuid references public.profiles(id) on delete set null,
  event_type text not null
    check (event_type in ('confirmed','ready','picked_up','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  related_food_id uuid references public.food_listings(id) on delete set null,
  related_reservation_id uuid references public.reservations(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================================
-- IMPACT EVENTS
-- =========================================================

create table if not exists public.impact_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  donation_id uuid references public.donations(id) on delete set null,
  event_type text not null
    check (event_type in ('food_donated','food_reserved','food_picked_up','food_rescued')),
  servings integer not null default 0 check (servings >= 0),
  created_at timestamptz not null default now()
);

-- =========================================================
-- REPORTS
-- =========================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  food_listing_id uuid references public.food_listings(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reason text not null,
  description text,
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_food_status      on public.food_listings(status);
create index if not exists idx_food_donor       on public.food_listings(donor_id);
create index if not exists idx_food_city        on public.food_listings(city);
create index if not exists idx_food_expiry      on public.food_listings(available_until);
create index if not exists idx_food_location    on public.food_listings(latitude, longitude);
create index if not exists idx_food_created     on public.food_listings(created_at desc);
create index if not exists idx_reservation_user on public.reservations(user_id);
create index if not exists idx_reservation_food on public.reservations(food_listing_id);
create index if not exists idx_reservation_status on public.reservations(status);
create index if not exists idx_notifications_user   on public.notifications(user_id);
create index if not exists idx_notifications_unread on public.notifications(user_id, is_read);
create index if not exists idx_donations_donor  on public.donations(donor_id);
create index if not exists idx_favorites_user   on public.favorites(user_id);

-- =========================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =========================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

drop trigger if exists profiles_updated_at    on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists food_listings_updated_at on public.food_listings;
create trigger food_listings_updated_at
  before update on public.food_listings
  for each row execute function public.set_updated_at();

drop trigger if exists reservations_updated_at  on public.reservations;
create trigger reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

drop trigger if exists partners_updated_at      on public.partners;
create trigger partners_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

drop trigger if exists reports_updated_at       on public.reports;
create trigger reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- =========================================================
-- AUTO-CREATE PROFILE AFTER SIGNUP
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    -- Try 'full_name' first (what signup() sends), fall back to 'name'
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      ''
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(
      (new.raw_user_meta_data->>'role')::public.user_role,
      'donor'::public.user_role
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- RESERVATION RPC — TRANSACTION SAFE
-- =========================================================

create or replace function public.reserve_food(
  p_food_listing_id uuid,
  p_servings integer,
  p_pickup_time timestamptz default null,
  p_notes text default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_food public.food_listings%rowtype;
  v_reservation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in';
  end if;

  if p_servings <= 0 then
    raise exception 'Servings must be greater than zero';
  end if;

  select * into v_food
  from public.food_listings
  where id = p_food_listing_id
  for update;

  if not found then
    raise exception 'Food listing not found';
  end if;

  if v_food.donor_id = auth.uid() then
    raise exception 'You cannot reserve your own food';
  end if;

  if v_food.status not in ('available', 'partially_reserved') then
    raise exception 'This food is no longer available';
  end if;

  if v_food.available_until <= now() then
    raise exception 'This food listing has expired';
  end if;

  if p_servings > v_food.available_servings then
    raise exception 'Not enough servings available. Requested: %, Available: %',
      p_servings, v_food.available_servings;
  end if;

  insert into public.reservations (food_listing_id, user_id, servings, pickup_time, notes)
  values (p_food_listing_id, auth.uid(), p_servings, p_pickup_time, p_notes)
  returning id into v_reservation_id;

  update public.food_listings
  set
    available_servings = available_servings - p_servings,
    status = case
      when available_servings - p_servings = 0 then 'reserved'::public.food_status
      else 'partially_reserved'::public.food_status
    end,
    updated_at = now()
  where id = p_food_listing_id;

  insert into public.impact_events (user_id, reservation_id, event_type, servings)
  values (auth.uid(), v_reservation_id, 'food_reserved', p_servings);

  return v_reservation_id;
end;
$$;

-- =========================================================
-- NEARBY FOOD RPC — Haversine distance
-- =========================================================

create or replace function public.get_nearby_food(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 10
)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  food_type text,
  servings integer,
  available_servings integer,
  image_url text,
  pickup_address text,
  city text,
  latitude double precision,
  longitude double precision,
  available_until timestamptz,
  status public.food_status,
  is_urgent boolean,
  distance_km double precision
)
language sql stable as $$
  select * from (
    select
      f.id, f.title, f.description, f.category, f.food_type,
      f.servings, f.available_servings, f.image_url,
      f.pickup_address, f.city, f.latitude, f.longitude,
      f.available_until, f.status, f.is_urgent,
      (
        6371 * acos(
          least(1, greatest(-1,
            cos(radians(p_latitude))
            * cos(radians(f.latitude))
            * cos(radians(f.longitude) - radians(p_longitude))
            + sin(radians(p_latitude))
            * sin(radians(f.latitude))
          ))
        )
      ) as distance_km
    from public.food_listings f
    where
      f.status in ('available', 'partially_reserved')
      and f.available_servings > 0
      and f.available_until > now()
      and f.latitude is not null
      and f.longitude is not null
  ) sub
  where sub.distance_km <= p_radius_km
  order by sub.distance_km asc;
$$;

-- =========================================================
-- USER IMPACT VIEW
-- =========================================================

create or replace view public.user_impact as
select
  p.id as user_id,
  coalesce(sum(case when ie.event_type = 'food_donated' then ie.servings else 0 end), 0) as meals_donated,
  coalesce(sum(case when ie.event_type = 'food_rescued' then ie.servings else 0 end), 0) as meals_rescued,
  count(distinct d.id) as donation_count,
  count(distinct r.id) as reservation_count
from public.profiles p
left join public.impact_events ie on ie.user_id = p.id
left join public.donations d on d.donor_id = p.id
left join public.reservations r on r.user_id = p.id
group by p.id;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles      enable row level security;
alter table public.food_listings enable row level security;
alter table public.donations     enable row level security;
alter table public.reservations  enable row level security;
alter table public.favorites     enable row level security;
alter table public.partners      enable row level security;
alter table public.pickup_events enable row level security;
alter table public.notifications enable row level security;
alter table public.impact_events enable row level security;
alter table public.reports       enable row level security;

-- ── Profiles ──────────────────────────────────────────────────────────────────

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

-- Allow authenticated users to insert their OWN profile row.
-- This is the safety net for the client-side upsert in signup(),
-- in case the DB trigger runs after the client tries to set role/phone.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── Food Listings ──────────────────────────────────────────────────────────────

drop policy if exists "food_select_authenticated" on public.food_listings;
create policy "food_select_authenticated" on public.food_listings
  for select to authenticated using (true);

drop policy if exists "food_insert_own" on public.food_listings;
create policy "food_insert_own" on public.food_listings
  for insert to authenticated with check (donor_id = auth.uid());

drop policy if exists "food_update_own" on public.food_listings;
create policy "food_update_own" on public.food_listings
  for update to authenticated
  using (donor_id = auth.uid()) with check (donor_id = auth.uid());

drop policy if exists "food_delete_own" on public.food_listings;
create policy "food_delete_own" on public.food_listings
  for delete to authenticated using (donor_id = auth.uid());

-- ── Donations ─────────────────────────────────────────────────────────────────

drop policy if exists "donations_select_own" on public.donations;
create policy "donations_select_own" on public.donations
  for select to authenticated using (donor_id = auth.uid());

drop policy if exists "donations_insert_own" on public.donations;
create policy "donations_insert_own" on public.donations
  for insert to authenticated with check (donor_id = auth.uid());

drop policy if exists "donations_update_own" on public.donations;
create policy "donations_update_own" on public.donations
  for update to authenticated using (donor_id = auth.uid());

-- ── Reservations ──────────────────────────────────────────────────────────────

drop policy if exists "reservations_select_own" on public.reservations;
create policy "reservations_select_own" on public.reservations
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.food_listings f
      where f.id = reservations.food_listing_id and f.donor_id = auth.uid()
    )
  );

drop policy if exists "reservations_insert_own" on public.reservations;
create policy "reservations_insert_own" on public.reservations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "reservations_update_own" on public.reservations;
create policy "reservations_update_own" on public.reservations
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.food_listings f
      where f.id = reservations.food_listing_id and f.donor_id = auth.uid()
    )
  );

-- ── Favorites ─────────────────────────────────────────────────────────────────

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Partners ──────────────────────────────────────────────────────────────────

drop policy if exists "partners_select" on public.partners;
create policy "partners_select" on public.partners
  for select to authenticated using (true);

drop policy if exists "partners_insert_own" on public.partners;
create policy "partners_insert_own" on public.partners
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "partners_update_own" on public.partners;
create policy "partners_update_own" on public.partners
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ── Notifications ─────────────────────────────────────────────────────────────

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Pickup Events ─────────────────────────────────────────────────────────────

drop policy if exists "pickup_select_authorized" on public.pickup_events;
create policy "pickup_select_authorized" on public.pickup_events
  for select to authenticated
  using (
    performed_by = auth.uid()
    or exists (
      select 1 from public.reservations r
      where r.id = pickup_events.reservation_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "pickup_insert_authenticated" on public.pickup_events;
create policy "pickup_insert_authenticated" on public.pickup_events
  for insert to authenticated with check (performed_by = auth.uid());

-- ── Impact Events ─────────────────────────────────────────────────────────────

drop policy if exists "impact_select_own" on public.impact_events;
create policy "impact_select_own" on public.impact_events
  for select to authenticated using (user_id = auth.uid());

-- ── Reports ───────────────────────────────────────────────────────────────────

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select to authenticated using (reporter_id = auth.uid());

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================

insert into storage.buckets (id, name, public)
values
  ('food-images', 'food-images', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ── Storage Policies ──────────────────────────────────────────────────────────

drop policy if exists "food_images_public_read" on storage.objects;
create policy "food_images_public_read" on storage.objects
  for select to public using (bucket_id = 'food-images');

drop policy if exists "food_images_authenticated_upload" on storage.objects;
create policy "food_images_authenticated_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'food-images');

drop policy if exists "food_images_authenticated_update" on storage.objects;
create policy "food_images_authenticated_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'food-images' and owner_id = auth.uid()::text);

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_upload" on storage.objects;
create policy "avatars_authenticated_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text);

-- =========================================================
-- DONE ✓ ShareBite v2 schema applied
-- =========================================================
