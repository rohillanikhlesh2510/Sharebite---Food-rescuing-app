-- =========================================================
-- SHAREBITE — CHAT, REALTIME LOCATION & NGO DISCOVERY MIGRATION
-- Adds: conversations, conversation_participants, messages
--       rider_location_updates, nearby_ngos() RPC, get_nearby_food() RPC
-- Safe & Idempotent (can be executed multiple times)
-- =========================================================

-- 0. SAFE ENUM GUARD
do $$ begin
  create type public.food_status as enum (
    'available',
    'partially_reserved',
    'reserved',
    'claimed',
    'picked_up',
    'completed',
    'cancelled',
    'expired'
  );
exception when duplicate_object then null; end $$;

-- 1. CONVERSATIONS
create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null default 'direct' check (type in ('direct', 'donation', 'delivery')),
  related_listing_id  uuid references public.food_listings(id) on delete set null,
  related_task_id     uuid,
  title               text,
  last_message_at     timestamptz default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 2. CONVERSATION PARTICIPANTS
create table if not exists public.conversation_participants (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text default 'member',
  last_read_at    timestamptz default now(),
  created_at      timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index if not exists idx_conv_part_user on public.conversation_participants(user_id);
create index if not exists idx_conv_part_conv on public.conversation_participants(conversation_id);

-- 3. MESSAGES
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null,
  message_type    text not null default 'text' check (message_type in ('text', 'image', 'location', 'system')),
  metadata        jsonb default '{}'::jsonb,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_conv_created on public.messages(conversation_id, created_at asc);
create index if not exists idx_messages_sender on public.messages(sender_id);

-- 4. RIDER LIVE LOCATION UPDATES
create table if not exists public.rider_location_updates (
  id               uuid primary key default gen_random_uuid(),
  rider_id         uuid not null,
  delivery_task_id uuid,
  latitude         double precision not null,
  longitude        double precision not null,
  heading          double precision,
  speed            double precision,
  recorded_at      timestamptz not null default now()
);

create index if not exists idx_rider_loc_task on public.rider_location_updates(delivery_task_id, recorded_at desc);
create index if not exists idx_rider_loc_rider on public.rider_location_updates(rider_id, recorded_at desc);

-- 5. HAVERSINE DISTANCE HELPER FUNCTION (IN KM)
drop function if exists public.calculate_distance_km(double precision, double precision, double precision, double precision);
create or replace function public.calculate_distance_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lon2 - lon1) / 2), 2)
    )
  );
$$;

-- 6. RPC: NEARBY NGOs
drop function if exists public.nearby_ngos(double precision, double precision, double precision);
create or replace function public.nearby_ngos(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 20.0
)
returns table (
  id uuid,
  full_name text,
  phone text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  avatar_url text,
  is_verified boolean,
  distance_km double precision
)
language sql
stable
as $$
  select
    p.id,
    p.full_name,
    p.phone,
    p.address,
    p.city,
    p.latitude,
    p.longitude,
    p.avatar_url,
    p.is_verified,
    round(public.calculate_distance_km(p_lat, p_lng, p.latitude, p.longitude)::numeric, 2)::double precision as distance_km
  from public.profiles p
  where p.role in ('ngo', 'volunteer')
    and p.latitude is not null
    and p.longitude is not null
    and public.calculate_distance_km(p_lat, p_lng, p.latitude, p.longitude) <= p_radius_km
  order by distance_km asc;
$$;

-- 7. RPC: GET NEARBY FOOD (Robust with text status)
drop function if exists public.get_nearby_food(double precision, double precision, double precision);
create or replace function public.get_nearby_food(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 25.0
)
returns table (
  id uuid,
  donor_id uuid,
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
  available_from timestamptz,
  available_until timestamptz,
  status text,
  is_urgent boolean,
  allergens text[],
  storage_type text,
  quantity_unit text,
  distance_km double precision
)
language sql
stable
as $$
  select
    fl.id,
    fl.donor_id,
    fl.title,
    fl.description,
    fl.category,
    fl.food_type,
    fl.servings,
    fl.available_servings,
    fl.image_url,
    fl.pickup_address,
    fl.city,
    fl.latitude,
    fl.longitude,
    fl.available_from,
    fl.available_until,
    fl.status::text as status,
    fl.is_urgent,
    fl.allergens,
    fl.storage_type,
    fl.quantity_unit,
    case
      when fl.latitude is not null and fl.longitude is not null
      then round(public.calculate_distance_km(p_lat, p_lng, fl.latitude, fl.longitude)::numeric, 2)::double precision
      else null
    end as distance_km
  from public.food_listings fl
  where (fl.status::text in ('available', 'active'))
    and fl.available_servings > 0
    and fl.available_until > now()
    and (
      (fl.latitude is not null and fl.longitude is not null and public.calculate_distance_km(p_lat, p_lng, fl.latitude, fl.longitude) <= p_radius_km)
      or fl.latitude is null
    )
  order by
    case when fl.is_urgent then 0 else 1 end asc,
    distance_km asc nulls last,
    fl.created_at desc;
$$;

-- 8. TRIGGER: Update conversation last_message_at on new message
create or replace function public.on_message_inserted()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists message_inserted_trigger on public.messages;
create trigger message_inserted_trigger
  after insert on public.messages
  for each row execute function public.on_message_inserted();

-- 9. ROW LEVEL SECURITY
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.rider_location_updates enable row level security;

-- Conversations: visible to participants
drop policy if exists "conv_participant_select" on public.conversations;
create policy "conv_participant_select" on public.conversations
  for select to authenticated
  using (
    id in (
      select conversation_id from public.conversation_participants
      where user_id = auth.uid()
    )
  );

drop policy if exists "conv_auth_insert" on public.conversations;
create policy "conv_auth_insert" on public.conversations
  for insert to authenticated
  with check (true);

-- Participants
drop policy if exists "part_select" on public.conversation_participants;
create policy "part_select" on public.conversation_participants
  for select to authenticated
  using (
    conversation_id in (
      select conversation_id from public.conversation_participants
      where user_id = auth.uid()
    )
  );

drop policy if exists "part_insert" on public.conversation_participants;
create policy "part_insert" on public.conversation_participants
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "part_update" on public.conversation_participants;
create policy "part_update" on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid());

-- Messages: readable by participants, insertable by participants
drop policy if exists "msg_select" on public.messages;
create policy "msg_select" on public.messages
  for select to authenticated
  using (
    conversation_id in (
      select conversation_id from public.conversation_participants
      where user_id = auth.uid()
    )
  );

drop policy if exists "msg_insert" on public.messages;
create policy "msg_insert" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid() and
    conversation_id in (
      select conversation_id from public.conversation_participants
      where user_id = auth.uid()
    )
  );

-- Location updates
drop policy if exists "loc_insert_rider" on public.rider_location_updates;
create policy "loc_insert_rider" on public.rider_location_updates
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "loc_select_participants" on public.rider_location_updates;
create policy "loc_select_participants" on public.rider_location_updates
  for select to authenticated
  using (auth.uid() is not null);

-- 10. REALTIME PUBLICATIONS
do $$ begin alter publication supabase_realtime add table public.conversations; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.messages; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rider_location_updates; exception when others then null; end $$;
