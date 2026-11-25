-- =========================================================
-- SHAREBITE — PROFILES RLS INFINITE RECURSION FIX
-- =========================================================
-- Root Cause:
--   The "admin_manage_profiles" policy (and similar) uses:
--     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
--   inside a policy ON public.profiles itself. PostgreSQL must evaluate
--   the policy to read from profiles -> which triggers the policy again -> infinite recursion.
--
-- Fix Strategy:
--   1. Create a SECURITY DEFINER helper function that reads the current
--      user's role from profiles while BYPASSING RLS (no recursion).
--   2. Replace ALL recursive profile-checking subqueries in policies
--      with calls to this safe helper function.
--
-- Safe to run multiple times (idempotent).
-- Run in Supabase Dashboard -> SQL Editor -> New Query
-- =========================================================

-- --- STEP 1: Create a SECURITY DEFINER helper to read the current user's role --
-- This function runs as the 'postgres' superuser role (SECURITY DEFINER),
-- so it bypasses RLS when reading from profiles. This prevents recursion.

create or replace function public.get_auth_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.profiles
  where id = (select auth.uid())
  limit 1;
$$;

-- Only authenticated users may call this function
revoke all on function public.get_auth_user_role() from public;
grant execute on function public.get_auth_user_role() to authenticated;

-- --- STEP 2: Fix public.profiles policies ------------------------------------
-- Drop all existing policies on profiles that could cause recursion

drop policy if exists "admin_manage_profiles"              on public.profiles;
drop policy if exists "profiles_select_authenticated"      on public.profiles;
drop policy if exists "profiles_insert_own"                on public.profiles;
drop policy if exists "profiles_update_own"                on public.profiles;

-- Users can read ANY profile (needed for donor/NGO cards, chat, etc.)
-- USING (true) on SELECT is safe here -- no self-reference recursion.
create policy "profiles_select_authenticated" on public.profiles
  for select
  to authenticated
  using (true);

-- Users can only insert their OWN profile row (used during signup)
create policy "profiles_insert_own" on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

-- Users can update only their OWN profile
create policy "profiles_update_own" on public.profiles
  for update
  to authenticated
  using  (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Admins can manage ALL profiles (update verification, roles, etc.)
-- Uses the SECURITY DEFINER helper -- no recursion.
create policy "admin_manage_profiles" on public.profiles
  for all
  to authenticated
  using  (public.get_auth_user_role() = 'admin')
  with check (public.get_auth_user_role() = 'admin');

-- --- STEP 3: Fix public.food_moderation policies ------------------------------
-- The "moderation_admin_all" policy had a recursive profiles subquery.

drop policy if exists "moderation_admin_all" on public.food_moderation;
create policy "moderation_admin_all" on public.food_moderation
  for all
  to authenticated
  using (public.get_auth_user_role() = 'admin');

-- --- STEP 4: Fix public.volunteer_tasks policies ------------------------------

drop policy if exists "volunteer_tasks_update_assigned" on public.volunteer_tasks;
create policy "volunteer_tasks_update_assigned" on public.volunteer_tasks
  for update
  to authenticated
  using (
    assigned_volunteer_id = (select auth.uid())
    or ngo_id = (select auth.uid())
    or public.get_auth_user_role() = 'admin'
  );

drop policy if exists "volunteer_tasks_insert_ngo" on public.volunteer_tasks;
create policy "volunteer_tasks_insert_ngo" on public.volunteer_tasks
  for insert
  to authenticated
  with check (
    ngo_id = (select auth.uid())
    or public.get_auth_user_role() in ('ngo', 'admin')
  );

-- --- STEP 5: Fix public.ngo_claims rider-read policy -------------------------

drop policy if exists "ngo_claims_rider_read" on public.ngo_claims;
create policy "ngo_claims_rider_read" on public.ngo_claims
  for select
  to authenticated
  using (
    public.get_auth_user_role() in ('rider', 'volunteer')
  );

-- --- STEP 6: Verify RLS is still enabled on profiles -------------------------
alter table public.profiles enable row level security;

-- =========================================================
-- DONE: Profiles RLS infinite recursion fully resolved.
-- All admin/role checks now use get_auth_user_role() SECURITY DEFINER function.
-- =========================================================
