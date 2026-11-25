-- =========================================================
-- SHAREBITE — AUTHORITATIVE AUTH, ROLE & SECURITY FIX
-- Non-destructive, idempotent SQL migration.
-- Run in Supabase Dashboard -> SQL Editor -> New Query
-- =========================================================

-- 1. Ensure all application roles exist in public.user_role enum
alter type public.user_role add value if not exists 'rider';
alter type public.user_role add value if not exists 'household';
alter type public.user_role add value if not exists 'community';
alter type public.user_role add value if not exists 'acceptor';

-- 2. Ensure required profile columns exist (safe idempotent checks)
alter table public.profiles add column if not exists organization_name text;
alter table public.profiles add column if not exists registration_number text;
alter table public.profiles add column if not exists verification_status text not null default 'pending';

-- 3. Harden get_auth_user_role() helper (SECURITY DEFINER, non-recursive)
create or replace function public.get_auth_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_auth_user_role() from public;
grant execute on function public.get_auth_user_role() to authenticated;

-- 4. Fix handle_new_user() trigger so signup metadata roles (donor, ngo, acceptor,
--    rider, volunteer, community, partner, household) are preserved accurately,
--    and self-registration can NEVER assign 'admin'.
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  v_raw_role  text := lower(trim(coalesce(new.raw_user_meta_data->>'role', '')));
  v_safe_role text;
  v_full_name text;
  v_dob       text;
  v_bio       text;
begin
  v_safe_role := case v_raw_role
    when 'ngo'       then 'ngo'
    when 'acceptor'  then 'ngo'
    when 'receiver'  then 'receiver'
    when 'rider'     then 'rider'
    when 'volunteer' then 'volunteer'
    when 'community' then 'community'
    when 'partner'   then 'partner'
    when 'household' then 'household'
    when 'donor'     then 'donor'
    -- Never allow self-registration as admin or unrecognized role via signup metadata
    else 'donor'
  end;

  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'ShareBite Member'
  );

  v_dob := nullif(trim(coalesce(new.raw_user_meta_data->>'date_of_birth', '')), '');
  v_bio := case when v_dob is not null then 'DOB: ' || v_dob else null end;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    organization_name,
    registration_number,
    address,
    city,
    bio,
    is_verified,
    verification_status
  )
  values (
    new.id,
    v_full_name,
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    v_safe_role::public.user_role,
    nullif(trim(coalesce(new.raw_user_meta_data->>'organization_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'registration_number', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'address', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'city', '')), ''),
    v_bio,
    false,
    'pending'
  )
  on conflict (id) do nothing;

  -- If registering as a rider, ensure rider record exists immediately
  if v_safe_role = 'rider' then
    insert into public.riders (user_id, name, phone, is_online, is_available, id_verified)
    values (
      new.id,
      v_full_name,
      coalesce(new.raw_user_meta_data->>'phone', ''),
      false,
      true,
      false
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Phase 7 Security: Prevent users from escalating their own role or
--    verification status via client-side profile updates.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  -- Allow SQL Editor / postgres migrations (auth.uid() is null) and service_role / admins
  if auth.uid() is not null
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and coalesce(public.get_auth_user_role(), '') <> 'admin'
  then
    if new.role is distinct from old.role then
      raise exception 'Permission denied: users cannot modify their own role'
        using errcode = '42501';
    end if;

    if new.is_verified is distinct from old.is_verified
       or new.verification_status is distinct from old.verification_status then
      raise exception 'Permission denied: only administrators can modify verification status'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;
create trigger trg_prevent_profile_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- 6. Strengthen profiles RLS policies (no self-admin insert, non-recursive admin control)
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and role::text <> 'admin');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "admin_manage_profiles" on public.profiles;
create policy "admin_manage_profiles" on public.profiles
  for all to authenticated
  using (coalesce(public.get_auth_user_role(), '') = 'admin')
  with check (coalesce(public.get_auth_user_role(), '') = 'admin');

-- 7. Harden admin_verify_profile RPC so NULL/anon callers cannot pass '<> admin'
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

-- 8. Targeted, non-destructive repair for verified live DB role mismatch:
--    During Phase 1 audit, account d3819150-4d31-4e95-8972-15b722d5f3e3
--    (ngo@sharebite.org / Robin Hood Army Delhi) had role = 'donor'.
--    This conditional update ONLY fixes that mismatched NGO account and leaves
--    all genuine donor accounts untouched.
update public.profiles
set
  role = 'ngo',
  updated_at = now()
where id = 'd3819150-4d31-4e95-8972-15b722d5f3e3'
  and lower(email) = 'ngo@sharebite.org'
  and role = 'donor';
