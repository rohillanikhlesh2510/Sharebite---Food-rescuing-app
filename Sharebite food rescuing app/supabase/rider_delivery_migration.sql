-- =========================================================
-- SHAREBITE — RIDER + DELIVERY SYSTEM MIGRATION
-- Run this AFTER the main migration.sql
-- Safe to re-run (idempotent guards on each block)
-- =========================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.vehicle_type as enum (
    'bike', 'motorcycle', 'bicycle', 'scooter', 'car'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.delivery_status as enum (
    'SEARCHING_RIDER',
    'RIDER_ASSIGNED',
    'GOING_TO_PICKUP',
    'FOOD_PICKED_UP',
    'GOING_TO_DROPOFF',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED'
  );
exception when duplicate_object then null; end $$;

-- Add rider role to existing user_role enum if not present
do $$ begin
  alter type public.user_role add value if not exists 'rider';
exception when others then null; end $$;

-- ── riders table ─────────────────────────────────────────────────────────────

create table if not exists public.riders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null default '',
  phone            text not null default '',
  vehicle_type     public.vehicle_type not null default 'bike',
  vehicle_number   text not null default '',
  profile_image    text,
  current_lat      double precision,
  current_lng      double precision,
  is_online        boolean not null default false,
  is_available     boolean not null default true,
  rating           numeric(3,2) not null default 5.00,
  total_deliveries integer not null default 0,
  total_earnings   integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id)
);

-- ── deliveries table ─────────────────────────────────────────────────────────

create table if not exists public.deliveries (
  id                uuid primary key default gen_random_uuid(),
  food_post_id      uuid references public.food_listings(id) on delete set null,
  donor_id          uuid references auth.users(id) on delete set null,
  receiver_id       uuid references auth.users(id) on delete set null,
  rider_id          uuid references public.riders(id) on delete set null,
  pickup_lat        double precision not null,
  pickup_lng        double precision not null,
  pickup_address    text not null default '',
  drop_lat          double precision not null,
  drop_lng          double precision not null,
  drop_address      text not null default '',
  food_name         text not null default '',
  food_quantity     text not null default '',
  status            public.delivery_status not null default 'SEARCHING_RIDER',
  rider_assigned_at timestamptz,
  arrived_at_pickup timestamptz,
  picked_up_at      timestamptz,
  delivered_at      timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancel_reason     text,
  is_self_pickup    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── rider_ratings table ───────────────────────────────────────────────────────

create table if not exists public.rider_ratings (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  rider_id    uuid not null references public.riders(id) on delete cascade,
  rater_id    uuid not null references auth.users(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (delivery_id, rater_id)
);

-- ── updated_at triggers ──────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists riders_updated_at on public.riders;
create trigger riders_updated_at
  before update on public.riders
  for each row execute function public.set_updated_at();

drop trigger if exists deliveries_updated_at on public.deliveries;
create trigger deliveries_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

-- ── Atomic rider assignment (prevents race conditions) ────────────────────────

create or replace function public.assign_rider_to_delivery(
  p_delivery_id uuid,
  p_rider_id    uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_delivery_status public.delivery_status;
  v_rider_available boolean;
begin
  select status into v_delivery_status
  from public.deliveries
  where id = p_delivery_id
  for update;

  select (is_online and is_available) into v_rider_available
  from public.riders
  where id = p_rider_id
  for update;

  if v_delivery_status <> 'SEARCHING_RIDER' then
    return false;
  end if;

  if not coalesce(v_rider_available, false) then
    return false;
  end if;

  update public.deliveries
  set status = 'RIDER_ASSIGNED',
      rider_id = p_rider_id,
      rider_assigned_at = now(),
      updated_at = now()
  where id = p_delivery_id;

  update public.riders
  set is_available = false, updated_at = now()
  where id = p_rider_id;

  return true;
end $$;

-- ── Recalc rider average rating ───────────────────────────────────────────────

create or replace function public.recalc_rider_rating(p_rider_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_avg numeric;
begin
  select avg(rating)::numeric(3,2) into v_avg
  from public.rider_ratings
  where rider_id = p_rider_id;

  update public.riders
  set rating = coalesce(v_avg, 5.00),
      total_deliveries = total_deliveries + 1,
      is_available = true,
      updated_at = now()
  where id = p_rider_id;
end $$;

create or replace function public.on_rider_rating_inserted()
returns trigger language plpgsql as $$
begin
  perform public.recalc_rider_rating(new.rider_id);
  return new;
end $$;

drop trigger if exists rider_rating_recalc on public.rider_ratings;
create trigger rider_rating_recalc
  after insert on public.rider_ratings
  for each row execute function public.on_rider_rating_inserted();

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.riders enable row level security;
alter table public.deliveries enable row level security;
alter table public.rider_ratings enable row level security;

drop policy if exists "riders_own_read" on public.riders;
drop policy if exists "riders_own_update" on public.riders;
drop policy if exists "riders_online_visible" on public.riders;
drop policy if exists "riders_insert_own" on public.riders;
drop policy if exists "deliveries_rider_read" on public.deliveries;
drop policy if exists "deliveries_donor_read" on public.deliveries;
drop policy if exists "deliveries_receiver_read" on public.deliveries;
drop policy if exists "deliveries_rider_update" on public.deliveries;
drop policy if exists "deliveries_insert_auth" on public.deliveries;
drop policy if exists "ratings_insert_auth" on public.rider_ratings;
drop policy if exists "ratings_read_own" on public.rider_ratings;

create policy "riders_own_read" on public.riders
  for select using (auth.uid() = user_id);

create policy "riders_own_update" on public.riders
  for update using (auth.uid() = user_id);

create policy "riders_insert_own" on public.riders
  for insert with check (auth.uid() = user_id);

create policy "riders_online_visible" on public.riders
  for select using (is_online = true);

create policy "deliveries_rider_read" on public.deliveries
  for select using (
    rider_id in (select id from public.riders where user_id = auth.uid())
  );

create policy "deliveries_rider_update" on public.deliveries
  for update using (
    rider_id in (select id from public.riders where user_id = auth.uid())
  );

create policy "deliveries_donor_read" on public.deliveries
  for select using (donor_id = auth.uid());

create policy "deliveries_receiver_read" on public.deliveries
  for select using (receiver_id = auth.uid());

create policy "deliveries_insert_auth" on public.deliveries
  for insert with check (auth.uid() is not null);

create policy "ratings_insert_auth" on public.rider_ratings
  for insert with check (rater_id = auth.uid());

create policy "ratings_read_own" on public.rider_ratings
  for select using (
    rater_id = auth.uid() or
    rider_id in (select id from public.riders where user_id = auth.uid())
  );

-- ── Enable Realtime ───────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.riders;
alter publication supabase_realtime add table public.deliveries;
alter publication supabase_realtime add table public.rider_ratings;
