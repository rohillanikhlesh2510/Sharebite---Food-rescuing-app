-- =========================================================
-- SHAREBITE — WEB & BACKEND INTEGRATION FIXES MIGRATION
-- Project: https://lzyuvgbhpkiqxscqxggq.supabase.co
-- Safe & Idempotent (can be executed multiple times)
-- Run this in your Supabase Dashboard -> SQL Editor -> New Query
-- =========================================================

-- 1. STORAGE BUCKETS SETUP
-- Create public storage buckets for food images and user avatars
insert into storage.buckets (id, name, public)
values
  ('food-images', 'food-images', true),
  ('avatars', 'avatars', true),
  ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

-- 2. STORAGE POLICIES
-- Food images public access & authenticated uploads
drop policy if exists "food_images_public_read" on storage.objects;
create policy "food_images_public_read" on storage.objects
  for select to public using (bucket_id = 'food-images');

drop policy if exists "food_images_authenticated_upload" on storage.objects;
create policy "food_images_authenticated_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'food-images');

drop policy if exists "food_images_authenticated_update" on storage.objects;
create policy "food_images_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'food-images');

-- Avatars public access & authenticated uploads
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_upload" on storage.objects;
create policy "avatars_authenticated_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');

-- 3. ADMIN PROFILE MANAGEMENT POLICY
-- Allows admins to update verification status on user profiles
-- IMPORTANT: Uses get_auth_user_role() SECURITY DEFINER function to avoid
-- infinite recursion (a subquery on public.profiles inside a policy ON
-- public.profiles causes PostgreSQL infinite recursion).
drop policy if exists "admin_manage_profiles" on public.profiles;
create policy "admin_manage_profiles" on public.profiles
  for all to authenticated
  using  (public.get_auth_user_role() = 'admin')
  with check (public.get_auth_user_role() = 'admin');

-- 4. REALTIME PUBLICATION SETUP
-- Ensure notifications and listings broadcast changes to connected clients
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.food_listings;
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.impact_events;

-- =========================================================
-- DONE: ShareBite storage & admin security verified
-- =========================================================
