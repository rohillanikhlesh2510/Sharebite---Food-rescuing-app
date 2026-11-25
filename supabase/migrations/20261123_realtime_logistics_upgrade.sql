-- =========================================================
-- SHAREBITE — Real-Time Food Rescue & Live Logistics Upgrade
-- Strictly Additive & Idempotent Migration (Safe on existing data)
-- Project: https://lzyuvgbhpkiqxscqxggq.supabase.co
-- Run in Staging first, then Production SQL Editor.
-- =========================================================

-- ─── 1. Extensions ───────────────────────────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists postgis;

-- ─── 2. Notification Enum Extensions ─────────────────────────────────────────
do $$ begin alter type public.notification_type add value if not exists 'food_nearby'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'pickup_nearby'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'donation_already_claimed'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'donation_cancelled'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'donation_reassigned'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'pickup_started'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'new_donation'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'donation_claimed'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'rider_assigned'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'delivery_completed'; exception when others then null; end $$;

-- ─── 3. Additive Columns & Spatial Geography Columns ─────────────────────────
-- profiles
alter table public.profiles add column if not exists location geography(Point, 4326);
alter table public.profiles add column if not exists is_available boolean not null default true;
alter table public.profiles add column if not exists service_radius_km double precision not null default 15;
alter table public.profiles add column if not exists operating_hours text;
alter table public.profiles add column if not exists food_preferences text[] default '{}';
alter table public.profiles add column if not exists daily_capacity integer;

-- riders
alter table public.riders add column if not exists location geography(Point, 4326);
alter table public.riders add column if not exists last_location_at timestamptz;
alter table public.riders add column if not exists location_accuracy_m double precision;
alter table public.riders add column if not exists service_radius_km double precision not null default 15;
alter table public.riders add column if not exists id_verified boolean not null default false;

-- food_listings
alter table public.food_listings add column if not exists location geography(Point, 4326);
alter table public.food_listings add column if not exists location_accuracy_m double precision;
alter table public.food_listings add column if not exists location_captured_at timestamptz;
alter table public.food_listings add column if not exists notification_radius_km double precision not null default 15;
alter table public.food_listings add column if not exists assigned_rider_id uuid references public.riders(id) on delete set null;
alter table public.food_listings add column if not exists accepted_by_role text;

-- delivery_tasks (supports NGO delivery AND direct rider pickup when rider accepts first)
alter table public.delivery_tasks add column if not exists assignment_type text not null default 'ngo_delivery';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'delivery_tasks_assignment_type_check'
  ) then
    alter table public.delivery_tasks
      add constraint delivery_tasks_assignment_type_check
      check (assignment_type in ('ngo_delivery', 'rider_direct_pickup'));
  end if;
exception when others then null;
end $$;

do $$
begin
  alter table public.delivery_tasks alter column ngo_id drop not null;
exception when others then null;
end $$;

-- rider_location_updates
alter table public.rider_location_updates add column if not exists accuracy_m double precision;

-- Backfill spatial points safely
update public.profiles
set location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
where latitude is not null and longitude is not null and location is null;

update public.riders
set location = ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::geography
where current_lat is not null and current_lng is not null and location is null;

update public.food_listings
set location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
where latitude is not null and longitude is not null and location is null;

-- Spatial GiST indexes
create index if not exists idx_profiles_location_gist on public.profiles using gist(location);
create index if not exists idx_riders_location_gist on public.riders using gist(location);
create index if not exists idx_food_listings_location_gist on public.food_listings using gist(location);
create index if not exists idx_food_listings_status_until on public.food_listings(status, available_until);
create index if not exists idx_riders_online_avail on public.riders(is_online, is_available);

-- Spatial sync triggers
create or replace function public.sync_lat_lng_to_location()
returns trigger language plpgsql as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location = ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.location = null;
  end if;
  return new;
end;
$$;

create or replace function public.sync_rider_lat_lng_to_location()
returns trigger language plpgsql as $$
begin
  if new.current_lat is not null and new.current_lng is not null then
    new.location = ST_SetSRID(ST_MakePoint(new.current_lng, new.current_lat), 4326)::geography;
  else
    new.location = null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_location on public.profiles;
create trigger trg_profiles_sync_location
  before insert or update of latitude, longitude on public.profiles
  for each row execute function public.sync_lat_lng_to_location();

drop trigger if exists trg_food_listings_sync_location on public.food_listings;
create trigger trg_food_listings_sync_location
  before insert or update of latitude, longitude on public.food_listings
  for each row execute function public.sync_lat_lng_to_location();

drop trigger if exists trg_riders_sync_location on public.riders;
create trigger trg_riders_sync_location
  before insert or update of current_lat, current_lng on public.riders
  for each row execute function public.sync_rider_lat_lng_to_location();

-- ─── 4. Status Audit History Table ───────────────────────────────────────────
create table if not exists public.donation_status_history (
  id              uuid primary key default gen_random_uuid(),
  food_listing_id uuid not null references public.food_listings(id) on delete cascade,
  delivery_task_id uuid references public.delivery_tasks(id) on delete set null,
  claim_id        uuid references public.ngo_claims(id) on delete set null,
  previous_status text,
  new_status      text not null,
  changed_by      uuid references public.profiles(id) on delete set null,
  actor_role      text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_dsh_listing on public.donation_status_history(food_listing_id, created_at desc);
create index if not exists idx_dsh_task on public.donation_status_history(delivery_task_id, created_at desc);

alter table public.donation_status_history enable row level security;

-- ─── 5. Security Helpers (Prevent RLS Recursion) ─────────────────────────────
create or replace function public.get_auth_user_role()
returns text
security definer
set search_path = public
language sql
stable as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
security definer
set search_path = public
language sql
stable as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;

-- ─── 6. Storage Buckets & Policies ───────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('food-images', 'food-images', true),
  ('avatars', 'avatars', true),
  ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

drop policy if exists "food_images_public_read" on storage.objects;
create policy "food_images_public_read" on storage.objects
  for select to public using (bucket_id = 'food-images');

drop policy if exists "food_images_authenticated_upload" on storage.objects;
create policy "food_images_authenticated_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'food-images');

drop policy if exists "food_images_owner_update" on storage.objects;
create policy "food_images_owner_update" on storage.objects
  for update to authenticated using (bucket_id = 'food-images' and owner = auth.uid());

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_upload" on storage.objects;
create policy "avatars_authenticated_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "id_docs_owner_read" on storage.objects;
create policy "id_docs_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'id-documents' and (owner = auth.uid() or public.get_auth_user_role() = 'admin'));

drop policy if exists "id_docs_owner_upload" on storage.objects;
create policy "id_docs_owner_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'id-documents');

-- ─── 7. Strict RLS Hardening ─────────────────────────────────────────────────
-- 7a. donation_status_history
drop policy if exists "dsh_authorized_select" on public.donation_status_history;
create policy "dsh_authorized_select" on public.donation_status_history
  for select to authenticated
  using (
    public.get_auth_user_role() = 'admin'
    or exists (
      select 1 from public.food_listings fl
      where fl.id = donation_status_history.food_listing_id
        and fl.donor_id = auth.uid()
    )
    or exists (
      select 1 from public.ngo_claims nc
      where nc.food_listing_id = donation_status_history.food_listing_id
        and nc.ngo_id = auth.uid()
    )
    or exists (
      select 1 from public.delivery_tasks dt
      join public.riders r on r.id = dt.rider_id
      where dt.food_listing_id = donation_status_history.food_listing_id
        and r.user_id = auth.uid()
    )
  );

-- 7b. rider_location_updates (Strict participant-only read; rider-only write)
drop policy if exists "loc_insert_rider" on public.rider_location_updates;
create policy "loc_insert_rider" on public.rider_location_updates
  for insert to authenticated
  with check (
    exists (
      select 1 from public.riders r
      where r.id = rider_location_updates.rider_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "loc_select_participants" on public.rider_location_updates;
create policy "loc_select_participants" on public.rider_location_updates
  for select to authenticated
  using (
    public.get_auth_user_role() = 'admin'
    or exists (
      select 1 from public.riders r
      where r.id = rider_location_updates.rider_id
        and r.user_id = auth.uid()
    )
    or (
      rider_location_updates.delivery_task_id is not null
      and exists (
        select 1 from public.delivery_tasks dt
        where dt.id = rider_location_updates.delivery_task_id
          and dt.status in ('rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit', 'delivered')
          and (dt.donor_id = auth.uid() or dt.ngo_id = auth.uid())
      )
    )
  );

-- 7c. riders (Prevent exposing all riders' live coordinates to unrelated users)
drop policy if exists "riders_online_visible" on public.riders;
drop policy if exists "riders_authorized_select" on public.riders;
create policy "riders_authorized_select" on public.riders
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.get_auth_user_role() = 'admin'
    or exists (
      select 1 from public.delivery_tasks dt
      where dt.rider_id = riders.id
        and dt.status in ('rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit', 'delivered', 'completed')
        and (dt.donor_id = auth.uid() or dt.ngo_id = auth.uid())
    )
  );

-- 7d. conversation_participants & conversations & messages (Fix recursion + secure participant checks)
drop policy if exists "part_select" on public.conversation_participants;
create policy "part_select" on public.conversation_participants
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "part_insert" on public.conversation_participants;
create policy "part_insert" on public.conversation_participants
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_conversation_participant(conversation_id)
    or not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
    )
  );

drop policy if exists "conv_participant_select" on public.conversations;
create policy "conv_participant_select" on public.conversations
  for select to authenticated
  using (public.is_conversation_participant(id));

drop policy if exists "msg_select" on public.messages;
create policy "msg_select" on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "msg_insert" on public.messages;
create policy "msg_insert" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

drop policy if exists "msg_update_read" on public.messages;
create policy "msg_update_read" on public.messages
  for update to authenticated
  using (public.is_conversation_participant(conversation_id));

-- 7e. delivery_tasks: allow NGO or Donor or Rider or Admin to read relevant tasks
drop policy if exists "delivery_tasks_rider" on public.delivery_tasks;
create policy "delivery_tasks_rider" on public.delivery_tasks
  for select to authenticated
  using (
    status = 'awaiting_rider'
    or rider_id in (select id from public.riders where user_id = auth.uid())
    or donor_id = auth.uid()
    or ngo_id = auth.uid()
    or public.get_auth_user_role() = 'admin'
  );

-- 7f. notifications: allow authenticated users to insert notifications only via RPC or for themselves
drop policy if exists "notifications_own_select" on public.notifications;
create policy "notifications_own_select" on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.get_auth_user_role() = 'admin');

drop policy if exists "notifications_own_update" on public.notifications;
create policy "notifications_own_update" on public.notifications
  for update to authenticated
  using (user_id = auth.uid());

-- ─── 8. PostGIS Nearby Discovery RPCs ────────────────────────────────────────
drop function if exists public.find_nearby_ngos(double precision, double precision, double precision, boolean);
create or replace function public.find_nearby_ngos(
  p_lat           double precision,
  p_lng           double precision,
  p_radius_km     double precision default 15.0,
  p_only_verified boolean default true
)
returns table (
  id                uuid,
  full_name         text,
  organization_name text,
  phone             text,
  address           text,
  city              text,
  latitude          double precision,
  longitude         double precision,
  avatar_url        text,
  is_verified       boolean,
  is_available      boolean,
  service_radius_km double precision,
  operating_hours   text,
  daily_capacity    integer,
  distance_km       double precision
)
security definer
set search_path = public
language sql
stable as $$
  select
    p.id,
    p.full_name,
    coalesce(p.organization_name, p.full_name) as organization_name,
    p.phone,
    p.address,
    p.city,
    p.latitude,
    p.longitude,
    p.avatar_url,
    p.is_verified,
    coalesce(p.is_available, true) as is_available,
    coalesce(p.service_radius_km, 15.0) as service_radius_km,
    p.operating_hours,
    p.daily_capacity,
    round(
      (
        ST_Distance(
          coalesce(p.location, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography),
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        ) / 1000.0
      )::numeric,
      2
    )::double precision as distance_km
  from public.profiles p
  where p.role::text in ('ngo', 'receiver', 'acceptor')
    and p.latitude is not null
    and p.longitude is not null
    and coalesce(p.is_available, true) = true
    and (not p_only_verified or p.is_verified = true)
    and ST_DWithin(
      coalesce(p.location, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography),
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      least(greatest(p_radius_km, 1.0), 100.0) * 1000.0
    )
  order by distance_km asc;
$$;

-- Keep legacy nearby_ngos wrapper compatible
drop function if exists public.nearby_ngos(double precision, double precision, double precision);
create or replace function public.nearby_ngos(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_km double precision default 20.0
)
returns table (
  id                uuid,
  full_name         text,
  organization_name text,
  phone             text,
  address           text,
  city              text,
  latitude          double precision,
  longitude         double precision,
  avatar_url        text,
  is_verified       boolean,
  distance_km       double precision
)
security definer
set search_path = public
language sql
stable as $$
  select
    n.id, n.full_name, n.organization_name, n.phone, n.address, n.city,
    n.latitude, n.longitude, n.avatar_url, n.is_verified, n.distance_km
  from public.find_nearby_ngos(p_lat, p_lng, p_radius_km, false) n;
$$;

drop function if exists public.find_nearby_riders(double precision, double precision, double precision);
create or replace function public.find_nearby_riders(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_km double precision default 15.0
)
returns table (
  rider_id          uuid,
  user_id           uuid,
  name              text,
  vehicle_type      text,
  rating            numeric,
  is_online         boolean,
  is_available      boolean,
  last_location_at  timestamptz,
  distance_km       double precision
)
security definer
set search_path = public
language sql
stable as $$
  -- Exposes only non-sensitive availability + distance; exact GPS coordinates are withheld
  select
    r.id as rider_id,
    r.user_id,
    r.name,
    r.vehicle_type::text as vehicle_type,
    r.rating,
    r.is_online,
    r.is_available,
    r.last_location_at,
    round(
      (
        ST_Distance(
          coalesce(r.location, ST_SetSRID(ST_MakePoint(r.current_lng, r.current_lat), 4326)::geography),
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        ) / 1000.0
      )::numeric,
      2
    )::double precision as distance_km
  from public.riders r
  where r.is_online = true
    and r.is_available = true
    and r.current_lat is not null
    and r.current_lng is not null
    and ST_DWithin(
      coalesce(r.location, ST_SetSRID(ST_MakePoint(r.current_lng, r.current_lat), 4326)::geography),
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      least(greatest(p_radius_km, 1.0), 100.0) * 1000.0
    )
  order by distance_km asc;
$$;

-- Upgraded PostGIS get_nearby_food RPC
drop function if exists public.get_nearby_food(double precision, double precision, double precision);
create or replace function public.get_nearby_food(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_km double precision default 25.0
)
returns table (
  id                 uuid,
  donor_id           uuid,
  title              text,
  description        text,
  category           text,
  food_type          text,
  servings           integer,
  available_servings integer,
  image_url          text,
  pickup_address     text,
  city               text,
  latitude           double precision,
  longitude          double precision,
  available_from     timestamptz,
  available_until    timestamptz,
  status             text,
  is_urgent          boolean,
  allergens          text[],
  storage_type       text,
  quantity_unit      text,
  distance_km        double precision
)
security definer
set search_path = public
language sql
stable as $$
  select
    fl.id,
    fl.donor_id,
    fl.title,
    fl.description,
    fl.category::text as category,
    fl.food_type::text as food_type,
    fl.servings,
    fl.available_servings,
    fl.image_url,
    -- Mask exact street pickup address until accepted unless caller is donor/admin
    case
      when fl.donor_id = auth.uid() or public.get_auth_user_role() = 'admin' then fl.pickup_address
      else coalesce(fl.city, 'Local Area')
    end as pickup_address,
    fl.city,
    fl.latitude,
    fl.longitude,
    fl.available_from,
    fl.available_until,
    fl.status::text as status,
    fl.is_urgent,
    fl.allergens,
    fl.storage_type::text as storage_type,
    fl.quantity_unit::text as quantity_unit,
    case
      when fl.latitude is not null and fl.longitude is not null then
        round(
          (
            ST_Distance(
              coalesce(fl.location, ST_SetSRID(ST_MakePoint(fl.longitude, fl.latitude), 4326)::geography),
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
            ) / 1000.0
          )::numeric,
          2
        )::double precision
      else null
    end as distance_km
  from public.food_listings fl
  where fl.status::text in ('available', 'partially_reserved', 'active')
    and fl.available_servings > 0
    and fl.available_until > now()
    and (
      fl.latitude is null or fl.longitude is null
      or ST_DWithin(
        coalesce(fl.location, ST_SetSRID(ST_MakePoint(fl.longitude, fl.latitude), 4326)::geography),
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        least(greatest(p_radius_km, 1.0), 100.0) * 1000.0
      )
    )
  order by
    case when fl.is_urgent then 0 else 1 end asc,
    distance_km asc nulls last,
    fl.created_at desc;
$$;

-- ─── 9. Core Logistics RPCs ──────────────────────────────────────────────────

-- 9a. publish_food_donation: Atomic create + PostGIS NGO & Rider notification fan-out
drop function if exists public.publish_food_donation(
  text, text, text, text, integer, text, text, text, double precision, double precision,
  double precision, timestamptz, timestamptz, timestamptz, boolean, text[], text, text,
  numeric, timestamptz, text, double precision
);
create or replace function public.publish_food_donation(
  p_title                  text,
  p_description            text default null,
  p_category               text default 'Other',
  p_food_type              text default 'veg',
  p_servings               integer default 1,
  p_image_url              text default null,
  p_pickup_address         text default null,
  p_city                   text default null,
  p_latitude               double precision default null,
  p_longitude              double precision default null,
  p_location_accuracy_m    double precision default null,
  p_location_captured_at   timestamptz default null,
  p_available_from         timestamptz default now(),
  p_available_until        timestamptz default (now() + interval '4 hours'),
  p_is_urgent              boolean default false,
  p_allergens              text[] default '{}',
  p_storage_type           text default 'room_temp',
  p_quantity_unit          text default 'servings',
  p_quantity_value         numeric default null,
  p_preparation_date       timestamptz default null,
  p_packaging_notes        text default null,
  p_notification_radius_km double precision default 15.0
)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid           uuid := auth.uid();
  v_listing       public.food_listings%rowtype;
  v_typed         public.food_listings%rowtype;
  v_ngo_count     integer := 0;
  v_rider_count   integer := 0;
  v_approx_area   text;
  v_ngo           record;
  v_rider         record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Exact GPS pickup coordinates are required';
  end if;

  if p_servings is null or p_servings <= 0 then
    raise exception 'Servings must be at least 1';
  end if;

  if p_available_until <= coalesce(p_available_from, now()) then
    raise exception 'Pickup deadline must be in the future';
  end if;

  v_approx_area := coalesce(nullif(trim(p_city), ''), split_part(coalesce(p_pickup_address, 'Nearby Area'), ',', 1));

  -- Resolve enum-or-text column types dynamically from public.food_listings catalog
  v_typed := jsonb_populate_record(
    null::public.food_listings,
    jsonb_build_object(
      'category',      coalesce(nullif(trim(p_category), ''), 'Other'),
      'food_type',     lower(replace(coalesce(nullif(trim(p_food_type), ''), 'veg'), '-', '_')),
      'storage_type',  coalesce(nullif(trim(p_storage_type), ''), 'room_temp'),
      'quantity_unit', coalesce(nullif(trim(p_quantity_unit), ''), 'servings'),
      'status',        'available'
    )
  );

  insert into public.food_listings (
    donor_id, title, description, category, food_type,
    servings, available_servings, image_url,
    pickup_address, city, latitude, longitude,
    location_accuracy_m, location_captured_at, notification_radius_km,
    available_from, available_until, status, is_urgent,
    allergens, storage_type, quantity_unit, quantity_value,
    preparation_date, packaging_notes
  )
  values (
    v_uid, p_title, p_description, v_typed.category, v_typed.food_type,
    p_servings, p_servings, p_image_url,
    p_pickup_address, p_city, p_latitude, p_longitude,
    p_location_accuracy_m, coalesce(p_location_captured_at, now()), coalesce(p_notification_radius_km, 15.0),
    coalesce(p_available_from, now()), p_available_until, v_typed.status, coalesce(p_is_urgent, false),
    coalesce(p_allergens, '{}'), v_typed.storage_type,
    v_typed.quantity_unit, coalesce(p_quantity_value, p_servings),
    p_preparation_date, p_packaging_notes
  )
  returning * into v_listing;

  -- Legacy donations & impact tracking
  insert into public.donations (food_listing_id, donor_id, servings, status)
  values (v_listing.id, v_uid, p_servings, 'active');

  insert into public.impact_events (user_id, event_type, servings)
  values (v_uid, 'food_donated', p_servings);

  -- Audit history
  insert into public.donation_status_history (
    food_listing_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_listing.id, null, 'AVAILABLE', v_uid, 'donor',
    'Published with ' || coalesce(p_notification_radius_km, 15.0) || ' km discovery radius'
  );

  -- Notify ALL verified available NGOs within configured radius
  for v_ngo in
    select * from public.find_nearby_ngos(p_latitude, p_longitude, coalesce(p_notification_radius_km, 15.0), true)
    where id <> v_uid
  loop
    insert into public.notifications (
      user_id, type, title, message, data, related_food_id, action_url
    ) values (
      v_ngo.id,
      'food_nearby',
      'NEW FOOD AVAILABLE!',
      p_title || ' (' || p_servings || ' ' || coalesce(p_quantity_unit, 'servings') || ') • ' || v_ngo.distance_km || ' km away in ' || v_approx_area,
      jsonb_build_object(
        'opportunity_type', 'ngo_food',
        'food_listing_id', v_listing.id,
        'title', p_title,
        'image_url', p_image_url,
        'servings', p_servings,
        'quantity_unit', coalesce(p_quantity_unit, 'servings'),
        'category', coalesce(p_category, 'Other'),
        'distance_km', v_ngo.distance_km,
        'approximate_area', v_approx_area,
        'available_until', p_available_until,
        'is_urgent', coalesce(p_is_urgent, false)
      ),
      v_listing.id,
      '/donations/' || v_listing.id
    );
    v_ngo_count := v_ngo_count + 1;
  end loop;

  -- Notify ALL online available riders within configured radius
  for v_rider in
    select * from public.find_nearby_riders(p_latitude, p_longitude, coalesce(p_notification_radius_km, 15.0))
    where user_id <> v_uid
  loop
    insert into public.notifications (
      user_id, type, title, message, data, related_food_id, action_url
    ) values (
      v_rider.user_id,
      'pickup_nearby',
      'NEW FOOD PICKUP AVAILABLE!',
      p_title || ' (' || p_servings || ' ' || coalesce(p_quantity_unit, 'servings') || ') • ' || v_rider.distance_km || ' km from you',
      jsonb_build_object(
        'opportunity_type', 'rider_pickup',
        'food_listing_id', v_listing.id,
        'title', p_title,
        'image_url', p_image_url,
        'servings', p_servings,
        'quantity_unit', coalesce(p_quantity_unit, 'servings'),
        'category', coalesce(p_category, 'Other'),
        'distance_km', v_rider.distance_km,
        'approximate_area', v_approx_area,
        'available_until', p_available_until,
        'is_urgent', coalesce(p_is_urgent, false)
      ),
      v_listing.id,
      '/rider-dashboard'
    );
    v_rider_count := v_rider_count + 1;
  end loop;

  -- Confirm to donor
  insert into public.notifications (
    user_id, type, title, message, data, related_food_id, action_url
  ) values (
    v_uid,
    'donation_created',
    'Donation Published Live',
    '"' || p_title || '" is now live. Notified ' || v_ngo_count || ' nearby verified NGO(s) and ' || v_rider_count || ' online rider(s).',
    jsonb_build_object('food_listing_id', v_listing.id, 'notified_ngos', v_ngo_count, 'notified_riders', v_rider_count),
    v_listing.id,
    '/donor-donations'
  );

  return jsonb_build_object(
    'listing', to_jsonb(v_listing),
    'notified_ngos', v_ngo_count,
    'notified_riders', v_rider_count
  );
end;
$$;

-- 9b. accept_donation: Atomic First-Acceptance-Wins (NGO OR Rider)
drop function if exists public.accept_donation(uuid, integer, timestamptz, text);


      end,
      accepted_by_role = 'ngo',
      updated_at = now()
    where id = p_food_listing_id;

    -- Create separate delivery task for riders to transport to this NGO
    insert into public.delivery_tasks (
      food_listing_id, claim_id, reservation_id,
      donor_id, ngo_id, assignment_type,
      pickup_address, pickup_lat, pickup_lng,
      dropoff_address, dropoff_lat, dropoff_lng,
      food_title, servings_required, quantity_unit,
      pickup_window_start, pickup_window_end, collection_deadline,
      instructions, status, pickup_code, dropoff_code
    )
    values (
      p_food_listing_id, v_claim_id, v_res_id,
      v_food.donor_id, v_uid, 'ngo_delivery',
      v_food.pickup_address, v_food.latitude, v_food.longitude,
      coalesce(v_profile.address, v_profile.city), v_profile.latitude, v_profile.longitude,
      v_food.title, v_servings, coalesce(v_food.quantity_unit, 'servings'),
      p_pickup_time, v_food.available_until, v_food.available_until,
      coalesce(p_notes, v_food.description), 'awaiting_rider', v_pickup_code, v_drop_code
    )
    returning id into v_task_id;

    insert into public.impact_events (user_id, reservation_id, event_type, servings)
    values (v_uid, v_res_id, 'food_reserved', v_servings);

    insert into public.donation_status_history (
      food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
    ) values (
      p_food_listing_id, v_task_id, v_claim_id, v_food.status::text, 'CLAIMED', v_uid, 'ngo',
      'Accepted by NGO ' || coalesce(v_profile.organization_name, v_profile.full_name)
    );

    -- Notify Donor
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
    values (
      v_food.donor_id,
      'donation_claimed',
      'NGO Accepted Your Donation!',
      coalesce(v_profile.organization_name, v_profile.full_name, 'An NGO') || ' accepted "' || v_food.title || '". Nearby riders are being notified for pickup.',
      jsonb_build_object('food_listing_id', p_food_listing_id, 'claim_id', v_claim_id, 'delivery_task_id', v_task_id),
      p_food_listing_id, v_claim_id, v_task_id, '/donor-dashboard'
    );

    -- Notify other nearby NGOs if full donation is now reserved
    if (v_food.available_servings - v_servings) = 0 and v_food.latitude is not null and v_food.longitude is not null then
      for v_ngo_row in
        select id from public.find_nearby_ngos(v_food.latitude, v_food.longitude, coalesce(v_food.notification_radius_km, 15.0), true)
        where id not in (v_uid, v_food.donor_id)
      loop
        insert into public.notifications (user_id, type, title, message, data, related_food_id)
        values (
          v_ngo_row.id,
          'donation_already_claimed',
          'Donation Already Claimed',
          '"' || v_food.title || '" has been claimed by another NGO.',
          jsonb_build_object('food_listing_id', p_food_listing_id),
          p_food_listing_id
        );
      end loop;
    end if;

    -- Notify nearby online riders about the new NGO delivery transport task
    if v_food.latitude is not null and v_food.longitude is not null then
      for v_rider_row in
        select * from public.find_nearby_riders(v_food.latitude, v_food.longitude, coalesce(v_food.notification_radius_km, 15.0))
        where user_id <> v_food.donor_id
      loop
        insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
        values (
          v_rider_row.user_id,
          'pickup_nearby',
          'NEW DELIVERY JOB AVAILABLE!',
          'Pickup "' || v_food.title || '" (' || v_servings || ' servings) -> ' || coalesce(v_profile.organization_name, v_profile.full_name) || ' • ' || v_rider_row.distance_km || ' km away',
          jsonb_build_object(
            'opportunity_type', 'delivery_task',
            'delivery_task_id', v_task_id,
            'food_listing_id', p_food_listing_id,
            'title', v_food.title,
            'image_url', v_food.image_url,
            'servings', v_servings,
            'distance_km', v_rider_row.distance_km,
            'available_until', v_food.available_until
          ),
          p_food_listing_id, v_task_id, '/rider-dashboard'
        );
      end loop;
    end if;

    return jsonb_build_object(
      'accepted_by', 'ngo',
      'claim_id', v_claim_id,
      'delivery_task_id', v_task_id,
      'status', 'awaiting_rider'
    );

  -- ── BRANCH B: Online Rider accepts pickup first ────────────────────────────
  elsif v_profile.role::text in ('rider', 'volunteer') then
    select * into v_rider from public.riders where user_id = v_uid for update;
    if not found then
      raise exception 'Rider profile not found';
    end if;

    if not coalesce(v_rider.is_available, true) then
      raise exception 'You already have an active delivery assignment. Complete it before accepting another.';
    end if;

    -- Ensure no open NGO claim already exists for this food
    if exists (
      select 1 from public.ngo_claims
      where food_listing_id = p_food_listing_id
        and status not in ('cancelled', 'expired')
    ) then
      raise exception 'ALREADY_CLAIMED: An NGO has already claimed this donation. Accept the delivery job from Rider Dashboard instead.';
    end if;

    insert into public.delivery_tasks (
      food_listing_id, rider_id, donor_id, ngo_id, assignment_type,
      pickup_address, pickup_lat, pickup_lng,
      dropoff_address, food_title, servings_required, quantity_unit,
      collection_deadline, instructions, status, pickup_code, dropoff_code, rider_assigned_at
    )
    values (
      p_food_listing_id, v_rider.id, v_food.donor_id, null, 'rider_direct_pickup',
      v_food.pickup_address, v_food.latitude, v_food.longitude,
      'Community Distribution / Partner Shelter', v_food.title, v_food.available_servings, coalesce(v_food.quantity_unit, 'servings'),
      v_food.available_until, coalesce(p_notes, v_food.description), 'rider_assigned', v_pickup_code, v_drop_code, now()
    )
    returning id into v_task_id;

    update public.food_listings
    set
      available_servings = 0,
      status = 'reserved'::public.food_status,
      assigned_rider_id = v_rider.id,
      accepted_by_role = 'rider',
      updated_at = now()
    where id = p_food_listing_id;

    update public.riders
    set is_available = false, updated_at = now()
    where id = v_rider.id;

    insert into public.donation_status_history (
      food_listing_id, delivery_task_id, previous_status, new_status, changed_by, actor_role, notes
    ) values (
      p_food_listing_id, v_task_id, v_food.status::text, 'RIDER_ASSIGNED', v_uid, 'rider',
      'Direct pickup accepted by rider ' || coalesce(v_rider.name, v_profile.full_name)
    );

    -- Notify Donor
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
    values (
      v_food.donor_id,
      'rider_assigned',
      'Rider Accepted Your Pickup!',
      coalesce(v_rider.name, v_profile.full_name, 'A ShareBite rider') || ' accepted "' || v_food.title || '" and is heading to your pickup location.',
      jsonb_build_object('food_listing_id', p_food_listing_id, 'delivery_task_id', v_task_id, 'rider_id', v_rider.id),
      p_food_listing_id, v_task_id, '/donor-dashboard'
    );

    -- Notify competing NGOs & riders that opportunity is no longer available
    if v_food.latitude is not null and v_food.longitude is not null then
      for v_ngo_row in
        select id from public.find_nearby_ngos(v_food.latitude, v_food.longitude, coalesce(v_food.notification_radius_km, 15.0), true)
        where id <> v_food.donor_id
      loop
        insert into public.notifications (user_id, type, title, message, data, related_food_id)
        values (
          v_ngo_row.id,
          'donation_already_claimed',
          'Donation Already Accepted',
          '"' || v_food.title || '" has already been accepted for pickup by a rider.',
          jsonb_build_object('food_listing_id', p_food_listing_id),
          p_food_listing_id
        );
      end loop;

      for v_rider_row in
        select user_id from public.find_nearby_riders(v_food.latitude, v_food.longitude, coalesce(v_food.notification_radius_km, 15.0))
        where user_id not in (v_uid, v_food.donor_id)
      loop
        insert into public.notifications (user_id, type, title, message, data, related_food_id)
        values (
          v_rider_row.user_id,
          'donation_already_claimed',
          'Pickup Opportunity Taken',
          '"' || v_food.title || '" was just accepted by another rider.',
          jsonb_build_object('food_listing_id', p_food_listing_id),
          p_food_listing_id
        );
      end loop;
    end if;

    return jsonb_build_object(
      'accepted_by', 'rider',
      'delivery_task_id', v_task_id,
      'status', 'rider_assigned'
    );
  else
    raise exception 'Only verified NGOs or online riders can accept food donations';
  end if;
end;
$$;

-- Compatibility wrapper for existing claim_food callers
drop function if exists public.claim_food(uuid, integer, timestamptz, text);
create or replace function public.claim_food(
  p_food_listing_id uuid,
  p_servings        integer,
  p_pickup_time     timestamptz default null,
  p_notes           text default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_res jsonb;
begin
  v_res := public.accept_donation(p_food_listing_id, p_servings, p_pickup_time, p_notes);
  return (v_res->>'claim_id')::uuid;
end;
$$;

-- 9c. Hardened accept_delivery_job (for NGO-claimed tasks awaiting a rider)
drop function if exists public.accept_delivery_job(uuid);
create or replace function public.accept_delivery_job(
  p_task_id uuid
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid     uuid := auth.uid();
  v_task    public.delivery_tasks%rowtype;
  v_rider   public.riders%rowtype;
  v_profile public.profiles%rowtype;
  v_other   record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.role::text not in ('rider', 'volunteer') then
    raise exception 'Only riders can accept delivery jobs';
  end if;

  select * into v_rider from public.riders where user_id = v_uid for update;
  if not found then
    raise exception 'Rider record not found';
  end if;

  if not coalesce(v_rider.is_available, true) then
    raise exception 'You already have an active delivery. Complete it first.';
  end if;

  select * into v_task from public.delivery_tasks where id = p_task_id for update;
  if not found then
    raise exception 'Delivery task not found';
  end if;

  if v_task.status <> 'awaiting_rider' or v_task.rider_id is not null then
    raise exception 'ALREADY_CLAIMED: This delivery job has already been accepted by another rider.';
  end if;

  update public.delivery_tasks
  set rider_id = v_rider.id,
      status = 'rider_assigned',
      rider_assigned_at = now(),
      updated_at = now()
  where id = p_task_id;

  update public.riders
  set is_available = false, updated_at = now()
  where id = v_rider.id;

  update public.food_listings
  set assigned_rider_id = v_rider.id, updated_at = now()
  where id = v_task.food_listing_id;

  if v_task.claim_id is not null then
    update public.ngo_claims
    set status = 'rider_assigned', rider_assigned_at = now(), updated_at = now()
    where id = v_task.claim_id;
  end if;

  insert into public.donation_status_history (
    food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_task.food_listing_id, p_task_id, v_task.claim_id, 'awaiting_rider', 'RIDER_ASSIGNED', v_uid, 'rider',
    'Assigned to rider ' || coalesce(v_rider.name, v_profile.full_name)
  );

  -- Notify Donor
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    'rider_assigned',
    'Rider Assigned to Your Donation',
    coalesce(v_rider.name, v_profile.full_name, 'A rider') || ' is heading to pick up "' || coalesce(v_task.food_title, 'food') || '".',
    jsonb_build_object('delivery_task_id', p_task_id, 'rider_id', v_rider.id),
    v_task.food_listing_id, p_task_id, '/donor-dashboard'
  );

  -- Notify NGO if present
  if v_task.ngo_id is not null then
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
    values (
      v_task.ngo_id,
      'rider_assigned',
      'Rider Assigned to Your Claim',
      coalesce(v_rider.name, v_profile.full_name, 'A rider') || ' accepted delivery of "' || coalesce(v_task.food_title, 'food') || '".',
      jsonb_build_object('delivery_task_id', p_task_id, 'rider_id', v_rider.id),
      v_task.food_listing_id, p_task_id, '/my-claims'
    );
  end if;

  -- Notify other online nearby riders that job is no longer available
  if v_task.pickup_lat is not null and v_task.pickup_lng is not null then
    for v_other in
      select user_id from public.find_nearby_riders(v_task.pickup_lat, v_task.pickup_lng, 20.0)
      where user_id <> v_uid
    loop
      insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id)
      values (
        v_other.user_id,
        'donation_already_claimed',
        'Delivery Job Taken',
        '"' || coalesce(v_task.food_title, 'Pickup') || '" has been accepted by another rider.',
        jsonb_build_object('delivery_task_id', p_task_id),
        v_task.food_listing_id, p_task_id
      );
    end loop;
  end if;

  return true;
end;
$$;

-- 9d. update_rider_location: Secure GPS update
drop function if exists public.update_rider_location(double precision, double precision, double precision, double precision, double precision, uuid);
create or replace function public.update_rider_location(
  p_lat              double precision,
  p_lng              double precision,
  p_accuracy_m       double precision default null,
  p_heading          double precision default null,
  p_speed            double precision default null,
  p_delivery_task_id uuid default null
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid   uuid := auth.uid();
  v_rider public.riders%rowtype;
  v_task  public.delivery_tasks%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid GPS coordinates';
  end if;

  select * into v_rider from public.riders where user_id = v_uid;
  if not found then
    raise exception 'Rider record not found';
  end if;

  update public.riders
  set
    current_lat = p_lat,
    current_lng = p_lng,
    location_accuracy_m = p_accuracy_m,
    last_location_at = now(),
    updated_at = now()
  where id = v_rider.id;

  if p_delivery_task_id is not null then
    select * into v_task from public.delivery_tasks where id = p_delivery_task_id;
    if found and v_task.rider_id = v_rider.id
       and v_task.status in ('rider_assigned', 'going_to_pickup', 'food_collected', 'in_transit') then
      insert into public.rider_location_updates (
        rider_id, delivery_task_id, latitude, longitude, heading, speed, accuracy_m
      ) values (
        v_rider.id, p_delivery_task_id, p_lat, p_lng, p_heading, p_speed, p_accuracy_m
      );
    end if;
  end if;

  return true;
end;
$$;

-- 9e. update_donation_status: Server-enforced status state machine
drop function if exists public.update_donation_status(uuid, text, text);
create or replace function public.update_donation_status(
  p_task_id    uuid,
  p_new_status text,
  p_notes      text default null
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid     uuid := auth.uid();
  v_task    public.delivery_tasks%rowtype;
  v_rider   public.riders%rowtype;
  v_role    text;
  v_allowed boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_task from public.delivery_tasks where id = p_task_id for update;
  if not found then raise exception 'Delivery task not found'; end if;

  select * into v_rider from public.riders where user_id = v_uid;
  v_role := public.get_auth_user_role();

  if not (
    v_role = 'admin'
    or (v_rider.id is not null and v_task.rider_id = v_rider.id)
    or v_task.donor_id = v_uid
    or v_task.ngo_id = v_uid
  ) then
    raise exception 'Not authorised to update this task status';
  end if;

  -- Validate allowed transitions
  if v_task.status = 'rider_assigned' and p_new_status in ('going_to_pickup', 'incident') then v_allowed := true; end if;
  if v_task.status = 'going_to_pickup' and p_new_status in ('food_collected', 'incident') then v_allowed := true; end if;
  if v_task.status = 'food_collected' and p_new_status in ('in_transit', 'delivered', 'incident') then v_allowed := true; end if;
  if v_task.status = 'in_transit' and p_new_status in ('delivered', 'incident') then v_allowed := true; end if;
  if v_task.status = 'delivered' and p_new_status in ('completed') then v_allowed := true; end if;
  if v_role = 'admin' then v_allowed := true; end if;

  if not v_allowed then
    raise exception 'Invalid status transition from % to %', v_task.status, p_new_status;
  end if;

  update public.delivery_tasks
  set status = p_new_status::public.delivery_task_status, updated_at = now()
  where id = p_task_id;

  if v_task.claim_id is not null and p_new_status in ('in_transit', 'delivered') then
    update public.ngo_claims
    set status = p_new_status::public.claim_status, updated_at = now()
    where id = v_task.claim_id;
  end if;

  insert into public.donation_status_history (
    food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_task.food_listing_id, p_task_id, v_task.claim_id, v_task.status::text, upper(p_new_status), v_uid, coalesce(v_role, 'user'), p_notes
  );

  -- Notify Donor
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    case when p_new_status = 'going_to_pickup' then 'pickup_started'::public.notification_type else 'system'::public.notification_type end,
    'Pickup Status: ' || replace(initcap(replace(p_new_status, '_', ' ')), 'Ngo', 'NGO'),
    'Update for "' || coalesce(v_task.food_title, 'donation') || '": ' || replace(p_new_status, '_', ' ') || '.',
    jsonb_build_object('delivery_task_id', p_task_id, 'status', p_new_status),
    v_task.food_listing_id, p_task_id, '/donor-dashboard'
  );

  -- Notify NGO if assigned
  if v_task.ngo_id is not null then
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
    values (
      v_task.ngo_id,
      'system',
      'Delivery Update: ' || initcap(replace(p_new_status, '_', ' ')),
      '"' || coalesce(v_task.food_title, 'Food delivery') || '" is now ' || replace(p_new_status, '_', ' ') || '.',
      jsonb_build_object('delivery_task_id', p_task_id, 'status', p_new_status),
      v_task.food_listing_id, p_task_id, '/my-claims'
    );
  end if;

  return true;
end;
$$;

-- 9f. Patch confirm_delivery_to_ngo for direct rider pickups (when ngo_id is null)
drop function if exists public.confirm_delivery_to_ngo(uuid, text, integer);
create or replace function public.confirm_delivery_to_ngo(
  p_task_id            uuid,
  p_dropoff_code       text,
  p_servings_delivered integer
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_task  public.delivery_tasks%rowtype;
  v_rider public.riders%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_rider from public.riders where user_id = auth.uid();
  if not found then raise exception 'Rider record not found'; end if;

  select * into v_task from public.delivery_tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;

  if v_task.rider_id <> v_rider.id then
    raise exception 'You are not assigned to this delivery';
  end if;

  if v_task.status not in ('food_collected', 'in_transit') then
    raise exception 'Cannot confirm delivery in status: %', v_task.status;
  end if;

  if v_task.ngo_id is not null and lower(coalesce(v_task.dropoff_code, '')) <> lower(coalesce(p_dropoff_code, '')) then
    raise exception 'Invalid delivery verification code';
  end if;

  update public.delivery_tasks
  set
    status = case when v_task.ngo_id is null then 'completed'::public.delivery_task_status else 'delivered'::public.delivery_task_status end,
    delivery_confirmed_at = now(),
    delivery_confirmed_by = auth.uid(),
    servings_delivered = p_servings_delivered,
    updated_at = now()
  where id = p_task_id;

  update public.riders
  set is_available = true, total_deliveries = total_deliveries + 1, updated_at = now()
  where id = v_rider.id;

  if v_task.ngo_id is null then
    update public.food_listings set status = 'completed', updated_at = now() where id = v_task.food_listing_id;
    insert into public.impact_events (user_id, event_type, servings) values (auth.uid(), 'food_rescued', p_servings_delivered);
  else
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
    values (
      v_task.ngo_id,
      'delivery_completed',
      'Food Delivered — Please Confirm Receipt',
      'The rider has delivered "' || coalesce(v_task.food_title, 'food') || '". Please confirm receipt.',
      jsonb_build_object('delivery_task_id', p_task_id),
      v_task.food_listing_id, p_task_id, '/my-claims'
    );
  end if;

  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    'delivery_completed',
    'Donation Delivered!',
    '"' || coalesce(v_task.food_title, 'Your food donation') || '" (' || p_servings_delivered || ' servings) has been safely delivered.',
    jsonb_build_object('delivery_task_id', p_task_id),
    v_task.food_listing_id, p_task_id, '/donor-donations'
  );

  insert into public.donation_status_history (
    food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_task.food_listing_id, p_task_id, v_task.claim_id, v_task.status::text,
    case when v_task.ngo_id is null then 'COMPLETED' else 'DELIVERED' end,
    auth.uid(), 'rider', 'Delivered ' || p_servings_delivered || ' servings'
  );

  return true;
end;
$$;

-- 9g. cancel_donation: Safe donor cancellation
drop function if exists public.cancel_donation(uuid, text);
create or replace function public.cancel_donation(
  p_food_listing_id uuid,
  p_reason          text default null
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid   uuid := auth.uid();
  v_food  public.food_listings%rowtype;
  v_task  record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_food from public.food_listings where id = p_food_listing_id for update;
  if not found then raise exception 'Food listing not found'; end if;

  if v_food.donor_id <> v_uid and coalesce(public.get_auth_user_role(), '') <> 'admin' then
    raise exception 'Only the donor can cancel this listing';
  end if;

  if exists (
    select 1 from public.delivery_tasks
    where food_listing_id = p_food_listing_id
      and status in ('food_collected', 'in_transit', 'delivered', 'completed')
  ) then
    raise exception 'Cannot cancel listing after food has been collected or delivered';
  end if;

  for v_task in
    select * from public.delivery_tasks
    where food_listing_id = p_food_listing_id
      and status in ('awaiting_rider', 'rider_assigned', 'going_to_pickup')
    for update
  loop
    if v_task.rider_id is not null then
      update public.riders set is_available = true, updated_at = now() where id = v_task.rider_id;
      insert into public.notifications (user_id, type, title, message, related_food_id)
      select r.user_id, 'donation_cancelled', 'Pickup Cancelled by Donor',
        'Donation "' || v_food.title || '" was cancelled by the donor.', p_food_listing_id
      from public.riders r where r.id = v_task.rider_id;
    end if;

    if v_task.ngo_id is not null then
      insert into public.notifications (user_id, type, title, message, related_food_id)
      values (v_task.ngo_id, 'donation_cancelled', 'Donation Cancelled',
        'Donation "' || v_food.title || '" was cancelled by the donor.', p_food_listing_id);
    end if;

    update public.delivery_tasks set status = 'cancelled', updated_at = now() where id = v_task.id;
  end loop;

  update public.ngo_claims
  set status = 'cancelled', cancellation_reason = coalesce(p_reason, 'Cancelled by donor'), updated_at = now()
  where food_listing_id = p_food_listing_id and status not in ('cancelled', 'expired', 'delivered', 'distributed');

  update public.food_listings
  set status = 'cancelled', updated_at = now()
  where id = p_food_listing_id;

  insert into public.donation_status_history (
    food_listing_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    p_food_listing_id, v_food.status::text, 'CANCELLED', v_uid, 'donor', p_reason
  );

  return true;
end;
$$;

-- 9h. reassign_donation: Controlled reopening if rider cancels before pickup
drop function if exists public.reassign_donation(uuid, text);
create or replace function public.reassign_donation(
  p_task_id uuid,
  p_reason  text default null
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid   uuid := auth.uid();
  v_task  public.delivery_tasks%rowtype;
  v_rider public.riders%rowtype;
  v_food  public.food_listings%rowtype;
  v_other record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_task from public.delivery_tasks where id = p_task_id for update;
  if not found then raise exception 'Delivery task not found'; end if;

  select * into v_rider from public.riders where user_id = v_uid;

  if not (
    public.get_auth_user_role() = 'admin'
    or (v_rider.id is not null and v_task.rider_id = v_rider.id)
    or v_task.ngo_id = v_uid
  ) then
    raise exception 'Not authorised to reassign this task';
  end if;

  if v_task.status not in ('rider_assigned', 'going_to_pickup') then
    raise exception 'Cannot reassign task after food has been collected (status: %)', v_task.status;
  end if;

  if v_task.rider_id is not null then
    update public.riders set is_available = true, updated_at = now() where id = v_task.rider_id;
  end if;

  select * into v_food from public.food_listings where id = v_task.food_listing_id for update;

  if v_task.assignment_type = 'rider_direct_pickup' or v_task.ngo_id is null then
    -- Reopen whole listing for both NGOs and Riders
    update public.delivery_tasks set status = 'cancelled', updated_at = now() where id = p_task_id;
    update public.food_listings
    set status = 'available', available_servings = v_food.servings, assigned_rider_id = null, accepted_by_role = null, updated_at = now()
    where id = v_task.food_listing_id;
  else
    -- Keep NGO claim, reopen delivery task for another rider
    update public.delivery_tasks
    set rider_id = null, status = 'awaiting_rider', rider_assigned_at = null, updated_at = now()
    where id = p_task_id;

    update public.food_listings set assigned_rider_id = null, updated_at = now() where id = v_task.food_listing_id;

    if v_task.claim_id is not null then
      update public.ngo_claims set status = 'awaiting_rider', rider_assigned_at = null, updated_at = now() where id = v_task.claim_id;
    end if;
  end if;

  insert into public.donation_status_history (
    food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_task.food_listing_id, p_task_id, v_task.claim_id, v_task.status::text, 'REASSIGNMENT_REQUIRED', v_uid,
    coalesce(public.get_auth_user_role(), 'rider'), coalesce(p_reason, 'Rider released assignment before pickup')
  );

  -- Notify Donor
  insert into public.notifications (user_id, type, title, message, related_food_id, action_url)
  values (
    v_task.donor_id, 'donation_reassigned', 'Reassigning Pickup Rider',
    'Previous rider released "' || coalesce(v_task.food_title, 'donation') || '". Nearby riders are being notified.',
    v_task.food_listing_id, '/donor-dashboard'
  );

  -- Re-notify nearby riders
  if v_food.latitude is not null and v_food.longitude is not null then
    for v_other in
      select * from public.find_nearby_riders(v_food.latitude, v_food.longitude, coalesce(v_food.notification_radius_km, 15.0))
      where user_id <> v_uid
    loop
      insert into public.notifications (user_id, type, title, message, data, related_food_id, action_url)
      values (
        v_other.user_id, 'pickup_nearby', 'NEW FOOD PICKUP AVAILABLE!',
        coalesce(v_task.food_title, 'Food pickup') || ' reopened • ' || v_other.distance_km || ' km away',
        jsonb_build_object('food_listing_id', v_food.id, 'title', v_food.title, 'servings', v_food.servings, 'distance_km', v_other.distance_km),
        v_food.id, '/rider-dashboard'
      );
    end loop;
  end if;

  return true;
end;
$$;

-- 9i. admin_verify_profile: Syncs profiles, partners, riders, and notifies user
drop function if exists public.admin_verify_profile(uuid, text, text);
create or replace function public.admin_verify_profile(
  p_profile_id uuid,
  p_status     text,
  p_notes      text default null
)
returns void
security definer
set search_path = public
language plpgsql as $$
begin
  if coalesce(public.get_auth_user_role(), '') <> 'admin' then
    raise exception 'Unauthorized: admin role required';
  end if;

  update public.profiles
  set
    verification_status = p_status,
    is_verified = (p_status = 'verified'),
    updated_at = now()
  where id = p_profile_id;

  begin
    update public.partners
    set is_verified = (p_status = 'verified'), updated_at = now()
    where profile_id = p_profile_id;
  exception when undefined_column then null;
  end;

  update public.riders
  set id_verified = (p_status = 'verified'), updated_at = now()
  where user_id = p_profile_id;

  insert into public.notifications (user_id, type, title, message, action_url)
  values (
    p_profile_id,
    'verification_update',
    case when p_status = 'verified' then 'Account Verified!' else 'Verification Status Updated' end,
    case when p_status = 'verified'
      then 'Your ShareBite account has been verified. You can now accept and coordinate food donations.'
      else coalesce(p_notes, 'Your verification status was updated to: ' || p_status)
    end,
    '/profile'
  );
end;
$$;

-- ─── 10. Recreate Dashboard Views (Security + Completeness) ──────────────────
drop view if exists public.donor_dashboard_view;
create view public.donor_dashboard_view as
select
  fl.id,
  fl.title,
  fl.status,
  fl.servings,
  fl.available_servings,
  fl.available_until,
  fl.is_urgent,
  fl.city,
  fl.pickup_address,
  fl.latitude,
  fl.longitude,
  fl.image_url,
  fl.created_at,
  fl.donor_id,
  fl.accepted_by_role,
  nc.id as claim_id,
  nc.ngo_id,
  nc.status as claim_status,
  nc.ngo_name,
  nc.servings_claimed,
  dt.id as delivery_task_id,
  dt.status as delivery_status,
  dt.assignment_type,
  dt.rider_id,
  r.user_id as rider_user_id,
  r.name as rider_name,
  r.phone as rider_phone,
  dt.pickup_code,
  dt.dropoff_address,
  dt.dropoff_lat,
  dt.dropoff_lng,
  dt.pickup_confirmed_at,
  dt.delivery_confirmed_at
from public.food_listings fl
left join public.ngo_claims nc on nc.food_listing_id = fl.id
  and nc.status not in ('cancelled', 'expired')
left join public.delivery_tasks dt on (dt.claim_id = nc.id or (dt.claim_id is null and dt.food_listing_id = fl.id))
  and dt.status not in ('cancelled')
left join public.riders r on r.id = dt.rider_id;

drop view if exists public.ngo_claims_dashboard_view;
create view public.ngo_claims_dashboard_view as
select
  nc.id,
  nc.food_listing_id,
  nc.ngo_id,
  nc.reservation_id,
  nc.servings_claimed,
  nc.status,
  nc.pickup_time,
  nc.notes,
  nc.cancellation_reason,
  nc.ngo_name,
  nc.confirmed_at,
  nc.rider_assigned_at,
  nc.collected_at,
  nc.delivered_at,
  nc.created_at,
  nc.updated_at,
  coalesce(fl.title, 'Food Donation') as food_title,
  fl.category,
  fl.food_type,
  fl.available_until,
  fl.pickup_address,
  fl.city as pickup_city,
  fl.latitude as pickup_lat,
  fl.longitude as pickup_lng,
  fl.image_url,
  fl.donor_id,
  p.full_name as donor_name,
  p.phone as donor_phone,
  dt.id as delivery_task_id,
  dt.status as delivery_status,
  dt.dropoff_code,
  dt.dropoff_address,
  dt.dropoff_lat,
  dt.dropoff_lng,
  dt.pickup_confirmed_at,
  dt.delivery_confirmed_at,
  dt.rider_id,
  r.user_id as rider_user_id,
  r.name as rider_name,
  r.phone as rider_phone,
  dr.id as distribution_record_id,
  dr.quantity_received,
  dr.quantity_distributed,
  dr.quantity_remaining,
  dr.status as distribution_status
from public.ngo_claims nc
join public.food_listings fl on fl.id = nc.food_listing_id
join public.profiles p on p.id = fl.donor_id
left join public.delivery_tasks dt on dt.claim_id = nc.id and dt.status not in ('cancelled')
left join public.riders r on r.id = dt.rider_id
left join public.distribution_records dr on dr.claim_id = nc.id;

-- SECURITY FIX: Never expose pickup_code or dropoff_code in rider_tasks_view!
drop view if exists public.rider_tasks_view;
create view public.rider_tasks_view as
select
  dt.id,
  dt.food_listing_id,
  dt.claim_id,
  dt.reservation_id,
  dt.rider_id,
  dt.donor_id,
  dt.ngo_id,
  dt.assignment_type,
  dt.pickup_address,
  dt.pickup_lat,
  dt.pickup_lng,
  dt.dropoff_address,
  dt.dropoff_lat,
  dt.dropoff_lng,
  dt.food_title,
  dt.servings_required,
  dt.quantity_unit,
  dt.pickup_window_start,
  dt.pickup_window_end,
  dt.collection_deadline,
  dt.status,
  dt.pickup_confirmed_at,
  dt.pickup_confirmed_by,
  dt.servings_collected,
  dt.collection_discrepancy,
  dt.delivery_confirmed_at,
  dt.delivery_confirmed_by,
  dt.servings_delivered,
  dt.incident_reported,
  dt.incident_type,
  dt.incident_notes,
  dt.incident_at,
  dt.instructions,
  dt.estimated_km,
  dt.rider_assigned_at,
  dt.created_at,
  dt.updated_at,
  fl.food_type,
  fl.category,
  fl.image_url,
  p_donor.full_name as donor_name,
  p_donor.phone as donor_phone,
  p_ngo.full_name as ngo_name,
  p_ngo.organization_name as ngo_org_name,
  p_ngo.phone as ngo_phone,
  nc.servings_claimed
from public.delivery_tasks dt
join public.food_listings fl on fl.id = dt.food_listing_id
join public.profiles p_donor on p_donor.id = dt.donor_id
left join public.profiles p_ngo on p_ngo.id = dt.ngo_id
left join public.ngo_claims nc on nc.id = dt.claim_id;

-- ─── 11. Realtime Publications ───────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table public.food_listings; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ngo_claims; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.delivery_tasks; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rider_location_updates; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.donation_status_history; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.riders; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.conversations; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.messages; exception when others then null; end $$;

-- =========================================================
-- DONE ✓ ShareBite Real-Time Logistics Migration Ready
-- =========================================================
