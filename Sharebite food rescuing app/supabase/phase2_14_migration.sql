-- =========================================================
-- SHAREBITE — Phase 2-14 Migration
-- Adds: ngo_claims, distribution_records, delivery_tasks
--       Extended lifecycles, secure RPCs, realtime pubs
-- Safe to run multiple times (idempotent)
-- =========================================================

-- ─── New Enums ────────────────────────────────────────────

do $$ begin
  create type public.claim_status as enum (
    'pending',
    'confirmed',
    'awaiting_rider',
    'rider_assigned',
    'pickup_in_progress',
    'food_collected',
    'in_transit',
    'delivered',
    'distribution_in_progress',
    'distributed',
    'cancelled',
    'expired',
    'disputed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.delivery_task_status as enum (
    'awaiting_rider',
    'rider_assigned',
    'going_to_pickup',
    'food_collected',
    'in_transit',
    'delivered',
    'completed',
    'cancelled',
    'incident'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.distribution_status as enum (
    'pending',
    'in_progress',
    'completed',
    'partial',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

-- Add new notification types
do $$ begin alter type public.notification_type add value if not exists 'claim_received'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'claim_confirmed'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'rider_accepted'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'food_collected'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'food_in_transit'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'ngo_receipt_confirmed'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'food_distributed'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'delivery_incident'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'distribution_complete'; exception when others then null; end $$;

-- ─── Add allergens / storage_type columns if missing ──────

alter table public.food_listings add column if not exists allergens text[] default '{}';
alter table public.food_listings add column if not exists storage_type text default 'room_temp';
alter table public.food_listings add column if not exists quantity_unit text default 'servings';
alter table public.food_listings add column if not exists quantity_value numeric(10,2);
alter table public.food_listings add column if not exists preparation_date timestamptz;
alter table public.food_listings add column if not exists packaging_notes text;

-- ─── NGO CLAIMS ───────────────────────────────────────────

create table if not exists public.ngo_claims (
  id                  uuid primary key default gen_random_uuid(),
  food_listing_id     uuid not null references public.food_listings(id) on delete cascade,
  ngo_id              uuid not null references public.profiles(id) on delete cascade,
  reservation_id      uuid references public.reservations(id) on delete set null,
  servings_claimed    integer not null check (servings_claimed > 0),
  status              public.claim_status not null default 'pending',
  pickup_time         timestamptz,
  notes               text,
  cancellation_reason text,
  -- Donor sees only these fields from the claim
  ngo_name            text,
  -- Timestamps for lifecycle tracking
  confirmed_at        timestamptz,
  rider_assigned_at   timestamptz,
  collected_at        timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (food_listing_id, ngo_id) -- one NGO, one claim per listing
);

create index if not exists idx_ngo_claims_food     on public.ngo_claims(food_listing_id);
create index if not exists idx_ngo_claims_ngo      on public.ngo_claims(ngo_id);
create index if not exists idx_ngo_claims_status   on public.ngo_claims(status);
create index if not exists idx_ngo_claims_reservation on public.ngo_claims(reservation_id);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ngo_claims_updated_at on public.ngo_claims;
create trigger ngo_claims_updated_at
  before update on public.ngo_claims
  for each row execute function public.set_updated_at();

-- ─── DELIVERY TASKS ───────────────────────────────────────

create table if not exists public.delivery_tasks (
  id                  uuid primary key default gen_random_uuid(),
  food_listing_id     uuid not null references public.food_listings(id) on delete cascade,
  claim_id            uuid references public.ngo_claims(id) on delete set null,
  reservation_id      uuid references public.reservations(id) on delete set null,
  rider_id            uuid references public.riders(id) on delete set null,
  donor_id            uuid not null references public.profiles(id) on delete cascade,
  ngo_id              uuid not null references public.profiles(id) on delete cascade,
  -- Locations (denormalized for performance, linked to authoritative records)
  pickup_address      text,
  pickup_lat          double precision,
  pickup_lng          double precision,
  dropoff_address     text,
  dropoff_lat         double precision,
  dropoff_lng         double precision,
  -- Food summary
  food_title          text,
  servings_required   integer not null check (servings_required > 0),
  quantity_unit       text default 'servings',
  -- Timing
  pickup_window_start timestamptz,
  pickup_window_end   timestamptz,
  collection_deadline timestamptz,
  -- Status tracking
  status              public.delivery_task_status not null default 'awaiting_rider',
  -- Confirmation codes (secure pickup / dropoff verification)
  pickup_code         text,
  dropoff_code        text,
  -- Actual confirmation records
  pickup_confirmed_at timestamptz,
  pickup_confirmed_by uuid references public.profiles(id) on delete set null,
  servings_collected  integer,
  collection_discrepancy text,
  delivery_confirmed_at timestamptz,
  delivery_confirmed_by uuid references public.profiles(id) on delete set null,
  servings_delivered  integer,
  -- Incident tracking
  incident_reported   boolean not null default false,
  incident_type       text,
  incident_notes      text,
  incident_at         timestamptz,
  -- Navigation
  instructions        text,
  estimated_km        double precision,
  -- Timestamps
  rider_assigned_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.delivery_tasks add column if not exists food_title text;

create index if not exists idx_delivery_tasks_rider    on public.delivery_tasks(rider_id);
create index if not exists idx_delivery_tasks_donor    on public.delivery_tasks(donor_id);
create index if not exists idx_delivery_tasks_ngo      on public.delivery_tasks(ngo_id);
create index if not exists idx_delivery_tasks_status   on public.delivery_tasks(status);
create index if not exists idx_delivery_tasks_listing  on public.delivery_tasks(food_listing_id);
create index if not exists idx_delivery_tasks_claim    on public.delivery_tasks(claim_id);

drop trigger if exists delivery_tasks_updated_at on public.delivery_tasks;
create trigger delivery_tasks_updated_at
  before update on public.delivery_tasks
  for each row execute function public.set_updated_at();

-- ─── Notifications link columns ────────────────────────────
alter table public.notifications add column if not exists related_claim_id uuid references public.ngo_claims(id) on delete set null;
alter table public.notifications add column if not exists related_delivery_id uuid references public.delivery_tasks(id) on delete set null;
alter table public.notifications add column if not exists action_url text;

-- ─── Rider Live Location Updates Table ───────────────────────
create table if not exists public.rider_location_updates (
  id               uuid primary key default gen_random_uuid(),
  rider_id         uuid not null,
  delivery_task_id uuid references public.delivery_tasks(id) on delete set null,
  latitude         double precision not null,
  longitude        double precision not null,
  heading          double precision,
  speed            double precision,
  recorded_at      timestamptz not null default now()
);

create index if not exists idx_rider_loc_task on public.rider_location_updates(delivery_task_id, recorded_at desc);
create index if not exists idx_rider_loc_rider on public.rider_location_updates(rider_id, recorded_at desc);

alter table public.rider_location_updates enable row level security;

drop policy if exists "loc_insert_rider" on public.rider_location_updates;
create policy "loc_insert_rider" on public.rider_location_updates
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "loc_select_participants" on public.rider_location_updates;
create policy "loc_select_participants" on public.rider_location_updates
  for select to authenticated
  using (auth.uid() is not null);

do $$ begin alter publication supabase_realtime add table public.rider_location_updates; exception when others then null; end $$;

-- ─── DISTRIBUTION RECORDS ─────────────────────────────────

create table if not exists public.distribution_records (
  id                   uuid primary key default gen_random_uuid(),
  food_listing_id      uuid not null references public.food_listings(id) on delete cascade,
  claim_id             uuid references public.ngo_claims(id) on delete set null,
  delivery_task_id     uuid references public.delivery_tasks(id) on delete set null,
  ngo_id               uuid not null references public.profiles(id) on delete cascade,
  recorded_by          uuid not null references public.profiles(id) on delete cascade,
  -- Quantities (in same unit as the claim / delivery)
  quantity_received    numeric(10,2) not null check (quantity_received >= 0),
  quantity_distributed numeric(10,2) not null default 0 check (quantity_distributed >= 0),
  quantity_remaining   numeric(10,2) generated always as (quantity_received - quantity_distributed) stored,
  quantity_rejected    numeric(10,2) not null default 0 check (quantity_rejected >= 0),
  quantity_unit        text not null default 'servings',
  -- Distribution event details
  distribution_date    date not null,
  distribution_time    timestamptz,
  distribution_location text,
  distribution_method  text default 'direct'
    check (distribution_method in ('direct','shelter_meal','community_kitchen','food_bank','other')),
  people_served        integer check (people_served >= 0),
  meal_portions        integer check (meal_portions >= 0),
  -- Status
  status               public.distribution_status not null default 'pending',
  -- Condition notes
  condition_notes      text,
  safety_concern       boolean not null default false,
  safety_notes         text,
  -- Evidence
  evidence_url         text,
  -- Admin verification
  is_verified          boolean not null default false,
  verified_by          uuid references public.profiles(id) on delete set null,
  verified_at          timestamptz,
  -- Timestamps
  receipt_confirmed_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint valid_distribution check (quantity_distributed + quantity_rejected <= quantity_received)
);

create index if not exists idx_distribution_ngo      on public.distribution_records(ngo_id);
create index if not exists idx_distribution_listing  on public.distribution_records(food_listing_id);
create index if not exists idx_distribution_claim    on public.distribution_records(claim_id);
create index if not exists idx_distribution_status   on public.distribution_records(status);

drop trigger if exists distribution_records_updated_at on public.distribution_records;
create trigger distribution_records_updated_at
  before update on public.distribution_records
  for each row execute function public.set_updated_at();

-- ─── Extend notifications table ──────────────────────────

alter table public.notifications add column if not exists related_claim_id uuid references public.ngo_claims(id) on delete set null;
alter table public.notifications add column if not exists related_delivery_id uuid references public.delivery_tasks(id) on delete set null;
alter table public.notifications add column if not exists action_url text;

-- ─── Add profile verification status ──────────────────────

alter table public.profiles add column if not exists organization_name text;
alter table public.profiles add column if not exists registration_number text;
alter table public.profiles add column if not exists verification_status text default 'pending';

-- =========================================================
-- SECURE RPC: claim_food
-- NGO claims a food listing (transactional, race-condition safe)
-- =========================================================

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
  v_food       public.food_listings%rowtype;
  v_profile    public.profiles%rowtype;
  v_claim_id   uuid;
  v_res_id     uuid;
begin
  -- Must be logged in
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Load caller profile
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  -- NGO / receiver roles only
  if v_profile.role not in ('ngo', 'receiver', 'volunteer') then
    raise exception 'Only NGOs and authorised organisations can claim food';
  end if;

  if p_servings <= 0 then
    raise exception 'Servings must be positive';
  end if;

  -- Lock the listing
  select * into v_food
  from public.food_listings
  where id = p_food_listing_id
  for update;

  if not found then
    raise exception 'Food listing not found';
  end if;

  -- Cannot claim own food
  if v_food.donor_id = auth.uid() then
    raise exception 'Donors cannot claim their own listing';
  end if;

  if v_food.status not in ('available', 'partially_reserved') then
    raise exception 'This food is no longer available (status: %)', v_food.status;
  end if;

  if v_food.available_until <= now() then
    raise exception 'This listing has expired';
  end if;

  if p_servings > v_food.available_servings then
    raise exception 'Requested % servings but only % available', p_servings, v_food.available_servings;
  end if;

  -- Check for duplicate claim by same NGO
  if exists (
    select 1 from public.ngo_claims
    where food_listing_id = p_food_listing_id
      and ngo_id = auth.uid()
      and status not in ('cancelled', 'expired')
  ) then
    raise exception 'Your organisation has already claimed this listing';
  end if;

  -- Create reservation (existing flow)
  insert into public.reservations (food_listing_id, user_id, servings, pickup_time, notes)
  values (p_food_listing_id, auth.uid(), p_servings, p_pickup_time, p_notes)
  returning id into v_res_id;

  -- Create NGO claim
  insert into public.ngo_claims (
    food_listing_id, ngo_id, reservation_id, servings_claimed,
    status, pickup_time, notes, ngo_name
  )
  values (
    p_food_listing_id, auth.uid(), v_res_id, p_servings,
    'confirmed', p_pickup_time, p_notes,
    coalesce(v_profile.organization_name, v_profile.full_name)
  )
  returning id into v_claim_id;

  -- Reduce available servings
  update public.food_listings
  set
    available_servings = available_servings - p_servings,
    status = case
      when available_servings - p_servings = 0 then 'reserved'::public.food_status
      else 'partially_reserved'::public.food_status
    end,
    updated_at = now()
  where id = p_food_listing_id;

  -- Impact event
  insert into public.impact_events (user_id, reservation_id, event_type, servings)
  values (auth.uid(), v_res_id, 'food_reserved', p_servings);

  -- Notify donor
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, action_url)
  values (
    v_food.donor_id,
    'claim_received',
    'Food Claimed by NGO',
    coalesce(v_profile.organization_name, v_profile.full_name, 'An organisation') || ' has claimed your donation "' || v_food.title || '".',
    jsonb_build_object('claim_id', v_claim_id, 'food_listing_id', p_food_listing_id),
    p_food_listing_id,
    v_claim_id,
    '/donations/' || p_food_listing_id
  );

  return v_claim_id;
end;
$$;

-- =========================================================
-- SECURE RPC: create_delivery_task
-- Creates a delivery task after a confirmed NGO claim
-- =========================================================

create or replace function public.create_delivery_task(
  p_claim_id uuid
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_claim      public.ngo_claims%rowtype;
  v_food       public.food_listings%rowtype;
  v_donor      public.profiles%rowtype;
  v_ngo        public.profiles%rowtype;
  v_task_id    uuid;
  v_pickup_code text;
  v_drop_code  text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_claim from public.ngo_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;

  -- Only the NGO that owns the claim or a donor can trigger this
  if v_claim.ngo_id != auth.uid() then
    select * into v_food from public.food_listings where id = v_claim.food_listing_id;
    if v_food.donor_id != auth.uid() then
      raise exception 'Not authorised to create delivery for this claim';
    end if;
  end if;

  if v_claim.status not in ('confirmed', 'awaiting_rider') then
    raise exception 'Claim is not in a state that allows rider assignment (status: %)', v_claim.status;
  end if;

  -- Prevent duplicate task
  if exists (
    select 1 from public.delivery_tasks
    where claim_id = p_claim_id
      and status not in ('cancelled')
  ) then
    raise exception 'A delivery task already exists for this claim';
  end if;

  select * into v_food   from public.food_listings where id = v_claim.food_listing_id;
  select * into v_donor  from public.profiles      where id = v_food.donor_id;
  select * into v_ngo    from public.profiles      where id = v_claim.ngo_id;

  -- Generate secure random codes
  v_pickup_code := upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6));
  v_drop_code   := upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6));

  insert into public.delivery_tasks (
    food_listing_id, claim_id, reservation_id,
    donor_id, ngo_id,
    pickup_address, pickup_lat, pickup_lng,
    dropoff_address, dropoff_lat, dropoff_lng,
    food_title, servings_required, quantity_unit,
    pickup_window_start, pickup_window_end, collection_deadline,
    instructions,
    status, pickup_code, dropoff_code
  )
  values (
    v_claim.food_listing_id, p_claim_id, v_claim.reservation_id,
    v_food.donor_id, v_claim.ngo_id,
    v_food.pickup_address, v_food.latitude, v_food.longitude,
    coalesce(v_ngo.address, v_ngo.city), v_ngo.latitude, v_ngo.longitude,
    v_food.title, v_claim.servings_claimed, coalesce(v_food.quantity_unit, 'servings'),
    v_claim.pickup_time, v_food.available_until, v_food.available_until,
    v_food.description,
    'awaiting_rider', v_pickup_code, v_drop_code
  )
  returning id into v_task_id;

  -- Update claim status
  update public.ngo_claims
  set status = 'awaiting_rider', updated_at = now()
  where id = p_claim_id;

  -- Notify NGO
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
  values (
    v_claim.ngo_id,
    'claim_confirmed',
    'Delivery Task Created',
    'A delivery task has been created for "' || v_food.title || '". We are looking for a rider.',
    jsonb_build_object('delivery_task_id', v_task_id, 'claim_id', p_claim_id),
    v_food.id,
    p_claim_id,
    v_task_id,
    '/requests'
  );

  return v_task_id;
end;
$$;

-- =========================================================
-- SECURE RPC: accept_delivery_job
-- Rider accepts an available delivery task (race-condition safe)
-- =========================================================

create or replace function public.accept_delivery_job(
  p_task_id uuid
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_task    public.delivery_tasks%rowtype;
  v_rider   public.riders%rowtype;
  v_profile public.profiles%rowtype;
  v_donor   public.profiles%rowtype;
  v_ngo     public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;

  if v_profile.role not in ('rider', 'volunteer') then
    raise exception 'Only riders can accept delivery jobs';
  end if;

  -- Lock rider record
  select * into v_rider from public.riders where user_id = auth.uid() for update;
  if not found then raise exception 'Rider record not found'; end if;

  if not v_rider.is_available then
    raise exception 'You already have an active delivery. Complete it first.';
  end if;

  -- Lock the delivery task
  select * into v_task from public.delivery_tasks where id = p_task_id for update;
  if not found then raise exception 'Delivery task not found'; end if;

  if v_task.status != 'awaiting_rider' then
    return false; -- Already taken or not available
  end if;

  -- Assign rider
  update public.delivery_tasks
  set
    rider_id = v_rider.id,
    status = 'rider_assigned',
    rider_assigned_at = now(),
    updated_at = now()
  where id = p_task_id;

  -- Mark rider unavailable
  update public.riders
  set is_available = false, updated_at = now()
  where id = v_rider.id;

  -- Update ngo_claim
  update public.ngo_claims
  set
    status = 'rider_assigned',
    rider_assigned_at = now(),
    updated_at = now()
  where id = v_task.claim_id;

  -- Notify donor
  select * into v_donor from public.profiles where id = v_task.donor_id;
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    'rider_assigned',
    'Rider Assigned to Your Donation',
    coalesce(v_rider.name, v_profile.full_name, 'A rider') || ' will collect "' || v_task.food_title || '" shortly.',
    jsonb_build_object('delivery_task_id', p_task_id, 'rider_id', v_rider.id),
    v_task.food_listing_id,
    p_task_id,
    '/donations/' || v_task.food_listing_id
  );

  -- Notify NGO
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.ngo_id,
    'rider_assigned',
    'Rider Assigned',
    coalesce(v_rider.name, v_profile.full_name, 'A rider') || ' has accepted the delivery of "' || v_task.food_title || '".',
    jsonb_build_object('delivery_task_id', p_task_id, 'rider_id', v_rider.id),
    v_task.food_listing_id,
    p_task_id,
    '/requests'
  );

  return true;
end;
$$;

-- =========================================================
-- SECURE RPC: confirm_pickup
-- Rider confirms physical pickup of food from donor
-- =========================================================

create or replace function public.confirm_pickup(
  p_task_id          uuid,
  p_pickup_code      text,
  p_servings_collected integer,
  p_discrepancy_notes text default null
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_task    public.delivery_tasks%rowtype;
  v_rider   public.riders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rider from public.riders where user_id = auth.uid();
  if not found then raise exception 'Rider record not found'; end if;

  select * into v_task from public.delivery_tasks
  where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;

  if v_task.rider_id != v_rider.id then
    raise exception 'You are not assigned to this delivery';
  end if;

  if v_task.status not in ('rider_assigned', 'going_to_pickup') then
    raise exception 'Cannot confirm pickup in current status: %', v_task.status;
  end if;

  -- Validate pickup code
  if lower(v_task.pickup_code) != lower(p_pickup_code) then
    raise exception 'Invalid pickup verification code';
  end if;

  -- Prevent re-confirmation
  if v_task.pickup_confirmed_at is not null then
    raise exception 'Pickup already confirmed';
  end if;

  update public.delivery_tasks
  set
    status = 'food_collected',
    pickup_confirmed_at = now(),
    pickup_confirmed_by = auth.uid(),
    servings_collected = p_servings_collected,
    collection_discrepancy = p_discrepancy_notes,
    updated_at = now()
  where id = p_task_id;

  -- Update claim
  update public.ngo_claims
  set status = 'food_collected', collected_at = now(), updated_at = now()
  where id = v_task.claim_id;

  -- Notify donor
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    'food_collected',
    'Food Collected by Rider',
    'Your donated food "' || v_task.food_title || '" has been picked up and is on its way to the NGO.',
    jsonb_build_object('delivery_task_id', p_task_id, 'servings_collected', p_servings_collected),
    v_task.food_listing_id,
    p_task_id,
    '/donations/' || v_task.food_listing_id
  );

  -- Notify NGO
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.ngo_id,
    'food_collected',
    'Food Collected — In Transit',
    '"' || v_task.food_title || '" has been collected and is now in transit to your location.',
    jsonb_build_object('delivery_task_id', p_task_id),
    v_task.food_listing_id,
    p_task_id,
    '/requests'
  );

  -- Update food listing
  update public.food_listings
  set status = 'picked_up', updated_at = now()
  where id = v_task.food_listing_id;

  return true;
end;
$$;

-- =========================================================
-- SECURE RPC: confirm_delivery_to_ngo
-- Rider submits delivery; NGO must independently confirm
-- =========================================================

create or replace function public.confirm_delivery_to_ngo(
  p_task_id       uuid,
  p_dropoff_code  text,
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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_rider from public.riders where user_id = auth.uid();
  if not found then raise exception 'Rider record not found'; end if;

  select * into v_task from public.delivery_tasks
  where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;

  if v_task.rider_id != v_rider.id then
    raise exception 'You are not assigned to this delivery';
  end if;

  if v_task.status not in ('food_collected', 'in_transit') then
    raise exception 'Cannot confirm delivery in status: %', v_task.status;
  end if;

  if lower(v_task.dropoff_code) != lower(p_dropoff_code) then
    raise exception 'Invalid delivery verification code';
  end if;

  update public.delivery_tasks
  set
    status = 'delivered',
    delivery_confirmed_at = now(),
    delivery_confirmed_by = auth.uid(),
    servings_delivered = p_servings_delivered,
    updated_at = now()
  where id = p_task_id;

  -- Make rider available again
  update public.riders
  set is_available = true, updated_at = now()
  where id = v_rider.id;

  -- Notify NGO to confirm receipt independently
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.ngo_id,
    'delivery_completed',
    'Food Delivered — Please Confirm Receipt',
    'The rider has delivered "' || v_task.food_title || '". Please confirm receipt and record the quantity.',
    jsonb_build_object('delivery_task_id', p_task_id),
    v_task.food_listing_id,
    p_task_id,
    '/requests'
  );

  return true;
end;
$$;

-- =========================================================
-- SECURE RPC: confirm_ngo_receipt
-- NGO independently confirms receipt and creates distribution record
-- =========================================================

create or replace function public.confirm_ngo_receipt(
  p_task_id          uuid,
  p_quantity_received numeric,
  p_condition_notes   text default null,
  p_safety_concern    boolean default false,
  p_safety_notes      text default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_task      public.delivery_tasks%rowtype;
  v_profile   public.profiles%rowtype;
  v_dist_id   uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then raise exception 'Profile not found'; end if;

  select * into v_task from public.delivery_tasks
  where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;

  if v_task.ngo_id != auth.uid() then
    raise exception 'Only the receiving NGO can confirm receipt';
  end if;

  if v_task.status not in ('delivered', 'food_collected', 'in_transit') then
    raise exception 'Cannot confirm receipt in status: %', v_task.status;
  end if;

  -- Update task
  update public.delivery_tasks
  set
    status = 'completed',
    updated_at = now()
  where id = p_task_id;

  -- Update claim
  update public.ngo_claims
  set
    status = 'delivered',
    delivered_at = now(),
    updated_at = now()
  where id = v_task.claim_id;

  -- Update food listing to completed
  update public.food_listings
  set status = 'completed', updated_at = now()
  where id = v_task.food_listing_id;

  -- Create distribution record (pending distribution)
  insert into public.distribution_records (
    food_listing_id, claim_id, delivery_task_id,
    ngo_id, recorded_by,
    quantity_received, quantity_unit,
    distribution_date,
    condition_notes, safety_concern, safety_notes,
    status, receipt_confirmed_at
  )
  values (
    v_task.food_listing_id, v_task.claim_id, p_task_id,
    auth.uid(), auth.uid(),
    p_quantity_received, coalesce(v_task.quantity_unit, 'servings'),
    current_date,
    p_condition_notes, p_safety_concern, p_safety_notes,
    'pending', now()
  )
  returning id into v_dist_id;

  -- Impact event
  insert into public.impact_events (user_id, event_type, servings)
  values (auth.uid(), 'food_rescued', floor(p_quantity_received)::integer);

  -- Notify donor
  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    'ngo_receipt_confirmed',
    'Food Received by NGO',
    'The NGO has confirmed receipt of "' || v_task.food_title || '". Your donation is making a real impact!',
    jsonb_build_object('delivery_task_id', p_task_id, 'quantity_received', p_quantity_received),
    v_task.food_listing_id,
    p_task_id,
    '/donations/' || v_task.food_listing_id
  );

  return v_dist_id;
end;
$$;

-- =========================================================
-- SECURE RPC: record_distribution
-- NGO records distribution of food to beneficiaries
-- =========================================================

create or replace function public.record_distribution(
  p_distribution_record_id uuid,
  p_quantity_to_distribute  numeric,
  p_people_served           integer default null,
  p_meal_portions           integer default null,
  p_distribution_method     text default 'direct',
  p_distribution_location   text default null,
  p_notes                   text default null
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_record   public.distribution_records%rowtype;
  v_profile  public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  select * into v_record from public.distribution_records
  where id = p_distribution_record_id for update;
  if not found then raise exception 'Distribution record not found'; end if;

  if v_record.ngo_id != auth.uid() then
    raise exception 'Only the receiving NGO can record distribution';
  end if;

  if v_record.safety_concern then
    raise exception 'Cannot distribute food flagged with a safety concern without admin clearance';
  end if;

  if p_quantity_to_distribute <= 0 then
    raise exception 'Distribution quantity must be positive';
  end if;

  -- Prevent over-distribution (accounts for cumulative distributions)
  if (v_record.quantity_distributed + p_quantity_to_distribute) > v_record.quantity_received then
    raise exception 'Cannot distribute % — only % remaining out of % received',
      p_quantity_to_distribute,
      (v_record.quantity_received - v_record.quantity_distributed),
      v_record.quantity_received;
  end if;

  update public.distribution_records
  set
    quantity_distributed = quantity_distributed + p_quantity_to_distribute,
    people_served = coalesce(people_served, 0) + coalesce(p_people_served, 0),
    meal_portions = coalesce(meal_portions, 0) + coalesce(p_meal_portions, 0),
    distribution_method = p_distribution_method,
    distribution_location = coalesce(p_distribution_location, distribution_location),
    condition_notes = coalesce(p_notes, condition_notes),
    distribution_time = now(),
    status = case
      when (quantity_distributed + p_quantity_to_distribute) >= quantity_received then 'completed'::public.distribution_status
      else 'in_progress'::public.distribution_status
    end,
    updated_at = now()
  where id = p_distribution_record_id;

  -- Update claim status
  update public.ngo_claims
  set status = 'distributed', updated_at = now()
  where id = v_record.claim_id
    and status = 'delivered';

  -- Notify NGO confirmation
  insert into public.notifications (user_id, type, title, message, data, related_food_id, action_url)
  values (
    auth.uid(),
    'food_distributed',
    'Distribution Recorded',
    'You have distributed ' || p_quantity_to_distribute || ' ' || v_record.quantity_unit ||
      case when p_people_served is not null then ' to approximately ' || p_people_served || ' people' else '' end || '.',
    jsonb_build_object(
      'distribution_record_id', p_distribution_record_id,
      'quantity_distributed', p_quantity_to_distribute,
      'people_served', p_people_served
    ),
    v_record.food_listing_id,
    '/requests'
  );

  -- Impact event
  insert into public.impact_events (user_id, event_type, servings)
  values (auth.uid(), 'food_rescued', floor(p_quantity_to_distribute)::integer);

  return true;
end;
$$;

-- =========================================================
-- SECURE RPC: report_delivery_incident
-- =========================================================

create or replace function public.report_delivery_incident(
  p_task_id      uuid,
  p_incident_type text,
  p_notes        text
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_task   public.delivery_tasks%rowtype;
  v_rider  public.riders%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_task from public.delivery_tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;

  -- Only the assigned rider or the NGO/donor can report
  select * into v_rider from public.riders where user_id = auth.uid();

  if not (
    (v_rider.id is not null and v_task.rider_id = v_rider.id)
    or v_task.ngo_id = auth.uid()
    or v_task.donor_id = auth.uid()
  ) then
    raise exception 'Not authorised to report incident on this task';
  end if;

  update public.delivery_tasks
  set
    incident_reported = true,
    incident_type = p_incident_type,
    incident_notes = p_notes,
    incident_at = now(),
    status = 'incident',
    updated_at = now()
  where id = p_task_id;

  return true;
end;
$$;

-- =========================================================
-- SECURE RPC: cancel_ngo_claim
-- =========================================================

create or replace function public.cancel_ngo_claim(
  p_claim_id uuid,
  p_reason   text default null
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_claim  public.ngo_claims%rowtype;
  v_food   public.food_listings%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_claim from public.ngo_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;

  if v_claim.ngo_id != auth.uid() then
    raise exception 'Only the claiming NGO can cancel this claim';
  end if;

  -- Can only cancel in early states
  if v_claim.status in ('food_collected', 'in_transit', 'delivered', 'distributed', 'cancelled', 'expired') then
    raise exception 'Cannot cancel claim in status: %', v_claim.status;
  end if;

  update public.ngo_claims
  set
    status = 'cancelled',
    cancellation_reason = p_reason,
    updated_at = now()
  where id = p_claim_id;

  -- Restore food availability
  update public.food_listings
  set
    available_servings = available_servings + v_claim.servings_claimed,
    status = 'available',
    updated_at = now()
  where id = v_claim.food_listing_id
    and status in ('reserved', 'partially_reserved', 'available');

  -- Cancel associated delivery task
  update public.delivery_tasks
  set status = 'cancelled', updated_at = now()
  where claim_id = p_claim_id and status in ('awaiting_rider');

  -- Cancel reservation
  update public.reservations
  set status = 'cancelled', updated_at = now()
  where id = v_claim.reservation_id;

  select * into v_food from public.food_listings where id = v_claim.food_listing_id;

  -- Notify donor
  insert into public.notifications (user_id, type, title, message, data, related_food_id, action_url)
  values (
    v_food.donor_id,
    'system',
    'Claim Cancelled',
    'The NGO has cancelled their claim on "' || v_food.title || '". Your listing is now available again.',
    jsonb_build_object('claim_id', p_claim_id),
    v_food.id,
    '/donations/' || v_food.id
  );

  return true;
end;
$$;

-- =========================================================
-- VIEWS for dashboards
-- =========================================================

create or replace view public.donor_dashboard_view as
select
  fl.id,
  fl.title,
  fl.status,
  fl.servings,
  fl.available_servings,
  fl.available_until,
  fl.is_urgent,
  fl.city,
  fl.created_at,
  fl.donor_id,
  -- Claim info
  nc.id as claim_id,
  nc.status as claim_status,
  nc.ngo_name,
  nc.servings_claimed,
  -- Delivery info
  dt.id as delivery_task_id,
  dt.status as delivery_status,
  r.name as rider_name,
  dt.pickup_confirmed_at,
  dt.delivery_confirmed_at
from public.food_listings fl
left join public.ngo_claims nc on nc.food_listing_id = fl.id
  and nc.status not in ('cancelled', 'expired')
left join public.delivery_tasks dt on dt.claim_id = nc.id
  and dt.status not in ('cancelled')
left join public.riders r on r.id = dt.rider_id;

create or replace view public.ngo_claims_dashboard_view as
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
  fl.image_url,
  p.full_name as donor_name,
  dt.id as delivery_task_id,
  dt.status as delivery_status,
  dt.pickup_code,
  dt.dropoff_code,
  dt.pickup_confirmed_at,
  dt.delivery_confirmed_at,
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

create or replace view public.rider_tasks_view as
select
  dt.id,
  dt.food_listing_id,
  dt.claim_id,
  dt.reservation_id,
  dt.rider_id,
  dt.donor_id,
  dt.ngo_id,
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
  dt.pickup_code,
  dt.dropoff_code,
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
  p_ngo.full_name as ngo_name,
  p_ngo.organization_name as ngo_org_name,
  nc.servings_claimed
from public.delivery_tasks dt
join public.food_listings fl on fl.id = dt.food_listing_id
join public.profiles p_donor on p_donor.id = dt.donor_id
join public.profiles p_ngo on p_ngo.id = dt.ngo_id
left join public.ngo_claims nc on nc.id = dt.claim_id;

-- =========================================================
-- IMPACT VIEW: Extended with distribution data
-- =========================================================

create or replace view public.platform_impact as
select
  count(distinct fl.id) filter (where fl.status not in ('cancelled')) as total_listings,
  count(distinct nc.id) filter (where nc.status not in ('cancelled', 'expired')) as total_claims,
  count(distinct dt.id) filter (where dt.status = 'completed') as total_deliveries,
  count(distinct dr.id) filter (where dr.status in ('completed', 'in_progress')) as total_distributions,
  coalesce(sum(dr.quantity_received) filter (where dr.receipt_confirmed_at is not null), 0) as total_kg_received,
  coalesce(sum(dr.quantity_distributed) filter (where dr.status != 'pending'), 0) as total_kg_distributed,
  coalesce(sum(dr.people_served) filter (where dr.people_served is not null), 0) as total_people_served,
  count(distinct fl.donor_id) as active_donors,
  count(distinct nc.ngo_id) as active_ngos,
  count(distinct dt.rider_id) as active_riders
from public.food_listings fl
left join public.ngo_claims nc on nc.food_listing_id = fl.id
left join public.delivery_tasks dt on dt.claim_id = nc.id
left join public.distribution_records dr on dr.claim_id = nc.id;

-- =========================================================
-- RLS for new tables
-- =========================================================

alter table public.ngo_claims          enable row level security;
alter table public.delivery_tasks      enable row level security;
alter table public.distribution_records enable row level security;

-- ngo_claims: NGO sees own claims; Donor sees claims on their listings; Riders see all confirmed claims
drop policy if exists "ngo_claims_ngo_own"    on public.ngo_claims;
create policy "ngo_claims_ngo_own" on public.ngo_claims
  for all to authenticated
  using (ngo_id = auth.uid());

drop policy if exists "ngo_claims_donor_read" on public.ngo_claims;
create policy "ngo_claims_donor_read" on public.ngo_claims
  for select to authenticated
  using (
    exists (
      select 1 from public.food_listings
      where id = ngo_claims.food_listing_id and donor_id = auth.uid()
    )
  );

drop policy if exists "ngo_claims_rider_read" on public.ngo_claims;
create policy "ngo_claims_rider_read" on public.ngo_claims
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('rider', 'volunteer'))
  );

-- delivery_tasks: Riders see assigned tasks + awaiting tasks; Donors/NGOs see related tasks
drop policy if exists "delivery_tasks_rider"    on public.delivery_tasks;
create policy "delivery_tasks_rider" on public.delivery_tasks
  for all to authenticated
  using (
    status = 'awaiting_rider'
    or rider_id in (select id from public.riders where user_id = auth.uid())
  );

drop policy if exists "delivery_tasks_donor"    on public.delivery_tasks;
create policy "delivery_tasks_donor" on public.delivery_tasks
  for select to authenticated
  using (donor_id = auth.uid());

drop policy if exists "delivery_tasks_ngo"      on public.delivery_tasks;
create policy "delivery_tasks_ngo" on public.delivery_tasks
  for select to authenticated
  using (ngo_id = auth.uid());

-- distribution_records: NGO sees own; Admin sees all
drop policy if exists "distribution_own"        on public.distribution_records;
create policy "distribution_own" on public.distribution_records
  for all to authenticated
  using (ngo_id = auth.uid() or recorded_by = auth.uid());

drop policy if exists "distribution_donor_read" on public.distribution_records;
create policy "distribution_donor_read" on public.distribution_records
  for select to authenticated
  using (
    exists (
      select 1 from public.food_listings
      where id = distribution_records.food_listing_id and donor_id = auth.uid()
    )
  );

-- =========================================================
-- Realtime publications for new tables
-- =========================================================

do $$ begin alter publication supabase_realtime add table public.ngo_claims; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.delivery_tasks; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.distribution_records; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reservations; exception when others then null; end $$;

-- =========================================================
-- DONE ✓ Phase 2-14 Migration
-- =========================================================
