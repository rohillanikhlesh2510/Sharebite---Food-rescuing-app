-- =========================================================
-- SHAREBITE — GOD MODE MIGRATION v1
-- Additive migration — SAFE to run on existing data
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- Run in Supabase SQL Editor → New Query
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1. PROFILE VERIFICATION FIELDS
--    Fix: verification.tsx writes these columns but they
--    didn't exist in the original profiles schema.
-- ─────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists verification_status text
    not null default 'pending'
    check (verification_status in ('pending','under_review','verified','rejected'));

alter table public.profiles
  add column if not exists registration_number text;

alter table public.profiles
  add column if not exists organization_type text;

alter table public.profiles
  add column if not exists verification_docs text[];

alter table public.profiles
  add column if not exists verification_submitted_at timestamptz;

alter table public.profiles
  add column if not exists verification_reviewed_at timestamptz;

alter table public.profiles
  add column if not exists verification_notes text;

-- Index for admin verification queue
create index if not exists idx_profiles_verification_status
  on public.profiles(verification_status)
  where verification_status = 'under_review';

-- ─────────────────────────────────────────────────────────
-- 2. CHAT ROOMS
-- ─────────────────────────────────────────────────────────

create table if not exists public.chat_rooms (
  id               uuid primary key default gen_random_uuid(),
  donation_id      uuid references public.food_listings(id) on delete cascade,
  donor_id         uuid not null references public.profiles(id) on delete cascade,
  ngo_id           uuid not null references public.profiles(id) on delete cascade,
  donation_title   text not null default '',
  last_message     text,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now(),
  -- Prevent duplicate rooms for same donation + pair
  unique (donation_id, donor_id, ngo_id)
);

-- Indexes
create index if not exists idx_chat_rooms_donor   on public.chat_rooms(donor_id);
create index if not exists idx_chat_rooms_ngo     on public.chat_rooms(ngo_id);
create index if not exists idx_chat_rooms_donation on public.chat_rooms(donation_id);
create index if not exists idx_chat_rooms_last_msg on public.chat_rooms(last_message_at desc);

-- ─────────────────────────────────────────────────────────
-- 3. CHAT MESSAGES
-- ─────────────────────────────────────────────────────────

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  sender_name   text not null default '',
  sender_avatar text,
  content       text not null,
  type          text not null default 'text'
    check (type in ('text', 'system', 'image', 'location', 'pickup_update')),
  is_read       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes for pagination and filtering
create index if not exists idx_chat_messages_room     on public.chat_messages(room_id, created_at desc);
create index if not exists idx_chat_messages_sender   on public.chat_messages(sender_id);
create index if not exists idx_chat_messages_unread   on public.chat_messages(room_id, is_read) where is_read = false;

-- Updated_at trigger
drop trigger if exists chat_messages_updated_at on public.chat_messages;
create trigger chat_messages_updated_at
  before update on public.chat_messages
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────
-- 4. DONATION RATINGS
--    General ratings (donor↔NGO), separate from rider_ratings
-- ─────────────────────────────────────────────────────────

create table if not exists public.donation_ratings (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid references public.reservations(id) on delete set null,
  food_listing_id uuid not null references public.food_listings(id) on delete cascade,
  rater_id        uuid not null references public.profiles(id) on delete cascade,
  ratee_id        uuid not null references public.profiles(id) on delete cascade,
  rating          smallint not null check (rating between 1 and 5),
  comment         text,
  rating_type     text not null default 'donation_experience'
    check (rating_type in ('donation_experience', 'pickup_experience', 'food_quality', 'communication')),
  created_at      timestamptz not null default now(),
  -- Prevent self-rating
  constraint no_self_rating check (rater_id <> ratee_id),
  -- One rating per rater per listing per type
  unique (food_listing_id, rater_id, rating_type)
);

create index if not exists idx_donation_ratings_ratee   on public.donation_ratings(ratee_id);
create index if not exists idx_donation_ratings_listing on public.donation_ratings(food_listing_id);
create index if not exists idx_donation_ratings_rater   on public.donation_ratings(rater_id);

-- ─────────────────────────────────────────────────────────
-- 5. NOTIFICATION TYPE ENUM — Add missing values
-- ─────────────────────────────────────────────────────────

do $$ begin
  alter type public.notification_type add value if not exists 'message_received';
exception when others then null;
end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'rating_received';
exception when others then null;
end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'verification_approved';
exception when others then null;
end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'verification_rejected';
exception when others then null;
end $$;

-- ─────────────────────────────────────────────────────────
-- 6. RLS POLICIES — Chat Rooms
-- ─────────────────────────────────────────────────────────

alter table public.chat_rooms enable row level security;

-- Users can only see rooms they participate in
drop policy if exists "chat_rooms_select" on public.chat_rooms;
create policy "chat_rooms_select" on public.chat_rooms
  for select using (
    auth.uid() = donor_id or auth.uid() = ngo_id
  );

-- Either participant can create a chat room
drop policy if exists "chat_rooms_insert" on public.chat_rooms;
create policy "chat_rooms_insert" on public.chat_rooms
  for insert with check (
    auth.uid() = donor_id or auth.uid() = ngo_id
  );

-- Only the system/participants can update last_message
drop policy if exists "chat_rooms_update" on public.chat_rooms;
create policy "chat_rooms_update" on public.chat_rooms
  for update using (
    auth.uid() = donor_id or auth.uid() = ngo_id
  );

-- ─────────────────────────────────────────────────────────
-- 7. RLS POLICIES — Chat Messages
-- ─────────────────────────────────────────────────────────

alter table public.chat_messages enable row level security;

-- Users can only read messages in rooms they belong to
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_rooms r
      where r.id = chat_messages.room_id
        and (r.donor_id = auth.uid() or r.ngo_id = auth.uid())
    )
  );

-- Users can only send messages in rooms they belong to
drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.chat_rooms r
      where r.id = chat_messages.room_id
        and (r.donor_id = auth.uid() or r.ngo_id = auth.uid())
    )
  );

-- Users can only update their own messages (e.g., mark read)
drop policy if exists "chat_messages_update" on public.chat_messages;
create policy "chat_messages_update" on public.chat_messages
  for update using (
    auth.uid() = sender_id
    or exists (
      select 1 from public.chat_rooms r
      where r.id = chat_messages.room_id
        and (r.donor_id = auth.uid() or r.ngo_id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────
-- 8. RLS POLICIES — Donation Ratings
-- ─────────────────────────────────────────────────────────

alter table public.donation_ratings enable row level security;

-- Anyone can see ratings (public trust scores)
drop policy if exists "donation_ratings_select" on public.donation_ratings;
create policy "donation_ratings_select" on public.donation_ratings
  for select using (true);

-- Only authenticated users can create ratings
drop policy if exists "donation_ratings_insert" on public.donation_ratings;
create policy "donation_ratings_insert" on public.donation_ratings
  for insert with check (auth.uid() = rater_id);

-- ─────────────────────────────────────────────────────────
-- 9. ENABLE REALTIME for Chat
-- ─────────────────────────────────────────────────────────

-- Add chat tables to the realtime publication
-- (Run these only if supabase_realtime publication exists)
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_rooms';
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
exception when others then
  -- Tables may already be in publication or publication doesn't exist — ignore
  null;
end $$;

-- ─────────────────────────────────────────────────────────
-- 10. VERIFICATION HELPER FUNCTION
--     Atomic profile verification update for admin use
-- ─────────────────────────────────────────────────────────

create or replace function public.admin_verify_profile(
  p_profile_id uuid,
  p_status text,
  p_notes text default null
)
returns void
security definer
set search_path = public
language plpgsql as $$
begin
  -- Only admins can call this
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Unauthorized: admin role required';
  end if;

  update public.profiles set
    verification_status = p_status,
    is_verified = (p_status = 'verified'),
    verification_reviewed_at = now(),
    verification_notes = p_notes
  where id = p_profile_id;

  -- Create a notification for the user
  insert into public.notifications (user_id, type, title, message)
  values (
    p_profile_id,
    case
      when p_status = 'verified' then 'verification_approved'::public.notification_type
      else 'verification_rejected'::public.notification_type
    end,
    case
      when p_status = 'verified' then 'Verification Approved'
      else 'Verification Update'
    end,
    case
      when p_status = 'verified'
        then 'Your organization has been verified on ShareBite. You can now access all features.'
      else coalesce(p_notes, 'Your verification could not be completed. Please contact support.')
    end
  );
end;
$$;

-- ─────────────────────────────────────────────────────────
-- DONE
-- Tables created: chat_rooms, chat_messages, donation_ratings
-- Columns added: profiles.verification_status,
--                profiles.registration_number,
--                profiles.organization_type,
--                profiles.verification_docs,
--                profiles.verification_submitted_at,
--                profiles.verification_reviewed_at,
--                profiles.verification_notes
-- ─────────────────────────────────────────────────────────
