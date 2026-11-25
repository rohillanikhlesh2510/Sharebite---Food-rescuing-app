-- ============================================================================
-- ShareBite: Dual Workflow (Donor->Rider->NGO & Donor->NGO Direct) Migration
-- Date: 2026-11-24
-- Additive & idempotent. Preserves all existing users, tables, and RLS.
-- ============================================================================

-- ─── 1. Schema Upgrades on public.ngo_claims ────────────────────────────────
alter table public.ngo_claims
  add column if not exists collection_method text not null default 'ngo_delivery',
  add column if not exists pickup_code text,
  add column if not exists servings_collected integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ngo_claims_collection_method_check'
      and conrelid = 'public.ngo_claims'::regclass
  ) then
    alter table public.ngo_claims
      add constraint ngo_claims_collection_method_check
      check (collection_method in ('ngo_delivery', 'direct_ngo_pickup'));
  end if;
end $$;

-- Ensure notification_type enum includes workflow lifecycle values
do $$ begin alter type public.notification_type add value if not exists 'claim_received'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'claim_confirmed'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'rider_accepted'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'food_collected'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'food_in_transit'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'ngo_receipt_confirmed'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'food_distributed'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'delivery_incident'; exception when others then null; end $$;
do $$ begin alter type public.notification_type add value if not exists 'distribution_complete'; exception when others then null; end $$;

-- ─── 2. Dual First-Acceptance-Wins + Direct NGO Pickup RPC ──────────────────
drop function if exists public.accept_donation(uuid, integer, timestamptz, text);
drop function if exists public.accept_donation(uuid, integer, timestamptz, text, text);

create or replace function public.accept_donation(
  p_food_listing_id   uuid,
  p_servings          integer default null,
  p_pickup_time       timestamptz default null,
  p_notes             text default null,
  p_collection_method text default 'ngo_delivery'
)
returns jsonb
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid               uuid := auth.uid();
  v_profile           public.profiles%rowtype;
  v_food              public.food_listings%rowtype;
  v_rider             public.riders%rowtype;
  v_claim_id          uuid;
  v_res_id            uuid;
  v_task_id           uuid;
  v_pickup_code       text;
  v_drop_code         text;
  v_servings          integer;
  v_collection_method text;
  v_ngo_row           record;
  v_rider_row         record;
  v_matched_ngo       record;
  v_has_matched_ngo   boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'User profile not found';
  end if;

  -- Lock the donation row first for strict first-acceptance serialization
  select * into v_food
  from public.food_listings
  where id = p_food_listing_id
  for update;

  if not found then
    raise exception 'Food donation not found';
  end if;

  if v_food.donor_id = v_uid then
    raise exception 'Donors cannot accept their own food donation';
  end if;

  if v_food.available_until <= now() then
    raise exception 'This food donation has expired';
  end if;

  if v_food.status not in ('available', 'partially_reserved') or v_food.available_servings <= 0 then
    raise exception 'ALREADY_CLAIMED: This donation has already been claimed by another user.';
  end if;

  v_servings := coalesce(p_servings, v_food.available_servings);
  if v_servings <= 0 or v_servings > v_food.available_servings then
    raise exception 'Requested % servings but only % available', v_servings, v_food.available_servings;
  end if;

  v_pickup_code := upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6));
  v_drop_code   := upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6));
  v_collection_method := case
    when p_collection_method = 'direct_ngo_pickup' then 'direct_ngo_pickup'
    else 'ngo_delivery'
  end;

  -- ── BRANCH A: Verified NGO / Acceptor claims first ─────────────────────────
  if v_profile.role::text in ('ngo', 'receiver', 'acceptor') then
    if not coalesce(v_profile.is_verified, false) then
      raise exception 'Only verified NGOs can claim food donations. Please complete NGO verification.';
    end if;

    if exists (
      select 1 from public.ngo_claims
      where food_listing_id = p_food_listing_id
        and ngo_id = v_uid
        and status not in ('cancelled', 'expired')
    ) then
      raise exception 'ALREADY_CLAIMED: Your organization has already claimed this donation.';
    end if;

    insert into public.reservations (food_listing_id, user_id, servings, status, pickup_time, notes)
    values (p_food_listing_id, v_uid, v_servings, 'confirmed', p_pickup_time, p_notes)
    returning id into v_res_id;

    insert into public.ngo_claims (
      food_listing_id, ngo_id, reservation_id, servings_claimed,
      status, collection_method, pickup_code, pickup_time, notes, ngo_name, confirmed_at
    )
    values (
      p_food_listing_id, v_uid, v_res_id, v_servings,
      case when v_collection_method = 'direct_ngo_pickup' then 'confirmed'::public.claim_status else 'awaiting_rider'::public.claim_status end,
      v_collection_method,
      v_pickup_code,
      p_pickup_time, p_notes,
      coalesce(v_profile.organization_name, v_profile.full_name, 'Verified NGO'),
      now()
    )
    returning id into v_claim_id;

    update public.food_listings
    set
      available_servings = available_servings - v_servings,
      status = case
        when available_servings - v_servings = 0 then 'reserved'::public.food_status
        else 'partially_reserved'::public.food_status
      end,
      accepted_by_role = 'ngo',
      updated_at = now()
    where id = p_food_listing_id;

    if v_collection_method = 'ngo_delivery' then
      -- Create delivery task for riders to transport food from donor to this NGO
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
    else
      v_task_id := null;
    end if;

    insert into public.impact_events (user_id, reservation_id, event_type, servings)
    values (v_uid, v_res_id, 'food_reserved', v_servings);

    insert into public.donation_status_history (
      food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
    ) values (
      p_food_listing_id, v_task_id, v_claim_id, v_food.status::text, 'CLAIMED', v_uid, 'ngo',
      case
        when v_collection_method = 'direct_ngo_pickup' then
          'Direct collection accepted by NGO ' || coalesce(v_profile.organization_name, v_profile.full_name)
        else
          'Accepted by NGO ' || coalesce(v_profile.organization_name, v_profile.full_name) || ' (rider delivery requested)'
      end
    );

    -- Notify Donor
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
    values (
      v_food.donor_id,
      'donation_claimed',
      case
        when v_collection_method = 'direct_ngo_pickup' then 'NGO Accepted Your Donation (Direct Pickup)!'
        else 'NGO Accepted Your Donation!'
      end,
      case
        when v_collection_method = 'direct_ngo_pickup' then
          coalesce(v_profile.organization_name, v_profile.full_name, 'An NGO') || ' accepted "' || v_food.title || '" for direct NGO collection.'
        else
          coalesce(v_profile.organization_name, v_profile.full_name, 'An NGO') || ' accepted "' || v_food.title || '". Nearby riders are being notified for pickup.'
      end,
      jsonb_build_object(
        'food_listing_id', p_food_listing_id,
        'claim_id', v_claim_id,
        'delivery_task_id', v_task_id,
        'collection_method', v_collection_method
      ),
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

    -- Notify nearby online riders only when rider delivery is requested
    if v_collection_method = 'ngo_delivery' and v_task_id is not null and v_food.latitude is not null and v_food.longitude is not null then
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
      'collection_method', v_collection_method,
      'claim_id', v_claim_id,
      'delivery_task_id', v_task_id,
      'pickup_code', v_pickup_code,
      'status', case when v_collection_method = 'direct_ngo_pickup' then 'confirmed' else 'awaiting_rider' end
    );

  -- ── BRANCH B: Online Rider accepts pickup first ────────────────────────────
  elsif v_profile.role::text in ('rider', 'volunteer') then
    -- Ensure rider row exists automatically so migrated/new rider accounts never block
    insert into public.riders (user_id, name, phone, is_online, is_available, id_verified)
    values (
      v_uid,
      coalesce(v_profile.full_name, 'ShareBite Rider'),
      v_profile.phone,
      true,
      true,
      coalesce(v_profile.is_verified, false)
    )
    on conflict (user_id) do nothing;

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

    -- Workflow A auto-match: find nearest verified available NGO if donation has coordinates
    if v_food.latitude is not null and v_food.longitude is not null then
      select * into v_matched_ngo
      from public.find_nearby_ngos(
        v_food.latitude,
        v_food.longitude,
        coalesce(v_food.notification_radius_km, 25.0),
        true
      )
      where id <> v_food.donor_id
      limit 1;

      if found then
        v_has_matched_ngo := true;
      end if;
    end if;

    if v_has_matched_ngo then
      insert into public.reservations (food_listing_id, user_id, servings, status, pickup_time, notes)
      values (p_food_listing_id, v_matched_ngo.id, v_food.available_servings, 'confirmed', p_pickup_time, p_notes)
      returning id into v_res_id;

      insert into public.ngo_claims (
        food_listing_id, ngo_id, reservation_id, servings_claimed,
        status, collection_method, pickup_code, pickup_time, notes, ngo_name,
        confirmed_at, rider_assigned_at
      )
      values (
        p_food_listing_id, v_matched_ngo.id, v_res_id, v_food.available_servings,
        'rider_assigned', 'ngo_delivery', v_pickup_code, p_pickup_time, p_notes,
        coalesce(v_matched_ngo.organization_name, v_matched_ngo.full_name, 'Verified NGO'),
        now(), now()
      )
      returning id into v_claim_id;

      insert into public.delivery_tasks (
        food_listing_id, claim_id, reservation_id,
        rider_id, donor_id, ngo_id, assignment_type,
        pickup_address, pickup_lat, pickup_lng,
        dropoff_address, dropoff_lat, dropoff_lng,
        food_title, servings_required, quantity_unit,
        collection_deadline, instructions, status, pickup_code, dropoff_code, rider_assigned_at
      )
      values (
        p_food_listing_id, v_claim_id, v_res_id,
        v_rider.id, v_food.donor_id, v_matched_ngo.id, 'ngo_delivery',
        v_food.pickup_address, v_food.latitude, v_food.longitude,
        coalesce(v_matched_ngo.address, v_matched_ngo.city, 'Partner NGO'),
        v_matched_ngo.latitude, v_matched_ngo.longitude,
        v_food.title, v_food.available_servings, coalesce(v_food.quantity_unit, 'servings'),
        v_food.available_until, coalesce(p_notes, v_food.description),
        'rider_assigned', v_pickup_code, v_drop_code, now()
      )
      returning id into v_task_id;
    else
      v_claim_id := null;
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
    end if;

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
      food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
    ) values (
      p_food_listing_id, v_task_id, v_claim_id, v_food.status::text, 'RIDER_ASSIGNED', v_uid, 'rider',
      case
        when v_has_matched_ngo then
          'Pickup accepted by rider ' || coalesce(v_rider.name, v_profile.full_name) || ' and matched to NGO ' || coalesce(v_matched_ngo.organization_name, v_matched_ngo.full_name)
        else
          'Direct pickup accepted by rider ' || coalesce(v_rider.name, v_profile.full_name)
      end
    );

    -- Notify Donor
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
    values (
      v_food.donor_id,
      'rider_assigned',
      'Rider Accepted Your Pickup!',
      coalesce(v_rider.name, v_profile.full_name, 'A ShareBite rider') || ' accepted "' || v_food.title || '" and is heading to your pickup location.',
      jsonb_build_object('food_listing_id', p_food_listing_id, 'delivery_task_id', v_task_id, 'rider_id', v_rider.id, 'claim_id', v_claim_id),
      p_food_listing_id, v_claim_id, v_task_id, '/donor-dashboard'
    );

    -- Notify matched NGO if auto-matched
    if v_has_matched_ngo then
      insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
      values (
        v_matched_ngo.id,
        'rider_assigned',
        'Incoming Delivery Assigned to Your NGO!',
        coalesce(v_rider.name, v_profile.full_name, 'A rider') || ' accepted "' || v_food.title || '" and will deliver it to your NGO.',
        jsonb_build_object('food_listing_id', p_food_listing_id, 'delivery_task_id', v_task_id, 'claim_id', v_claim_id, 'dropoff_code', v_drop_code),
        p_food_listing_id, v_claim_id, v_task_id, '/my-claims'
      );
    end if;

    -- Notify competing NGOs & riders that opportunity is no longer available
    if v_food.latitude is not null and v_food.longitude is not null then
      for v_ngo_row in
        select id from public.find_nearby_ngos(v_food.latitude, v_food.longitude, coalesce(v_food.notification_radius_km, 15.0), true)
        where id <> v_food.donor_id
          and (not v_has_matched_ngo or id <> v_matched_ngo.id)
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
      'claim_id', v_claim_id,
      'delivery_task_id', v_task_id,
      'status', 'rider_assigned'
    );
  else
    raise exception 'Only verified NGOs or online riders can accept food donations';
  end if;
end;
$$;

-- Compatibility wrapper for legacy claim_food callers
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
  v_res := public.accept_donation(p_food_listing_id, p_servings, p_pickup_time, p_notes, 'ngo_delivery');
  return (v_res->>'claim_id')::uuid;
end;
$$;

-- ─── 3. Upgrade create_delivery_task (convert Direct Pickup -> Rider Delivery)
create or replace function public.create_delivery_task(
  p_claim_id uuid
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_claim       public.ngo_claims%rowtype;
  v_food        public.food_listings%rowtype;
  v_ngo         public.profiles%rowtype;
  v_task_id     uuid;
  v_pickup_code text;
  v_drop_code   text;
  v_rider_row   record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_claim from public.ngo_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;

  if v_claim.ngo_id != auth.uid() then
    select * into v_food from public.food_listings where id = v_claim.food_listing_id;
    if v_food.donor_id != auth.uid() then
      raise exception 'Not authorised to create delivery for this claim';
    end if;
  end if;

  if v_claim.status not in ('confirmed', 'awaiting_rider') then
    raise exception 'Claim is not in a state that allows rider assignment (status: %)', v_claim.status;
  end if;

  if exists (
    select 1 from public.delivery_tasks
    where claim_id = p_claim_id
      and status not in ('cancelled')
  ) then
    raise exception 'A delivery task already exists for this claim';
  end if;

  select * into v_food from public.food_listings where id = v_claim.food_listing_id;
  select * into v_ngo  from public.profiles where id = v_claim.ngo_id;

  v_pickup_code := coalesce(v_claim.pickup_code, upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6)));
  v_drop_code   := upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6));

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
    v_claim.food_listing_id, p_claim_id, v_claim.reservation_id,
    v_food.donor_id, v_claim.ngo_id, 'ngo_delivery',
    v_food.pickup_address, v_food.latitude, v_food.longitude,
    coalesce(v_ngo.address, v_ngo.city), v_ngo.latitude, v_ngo.longitude,
    v_food.title, v_claim.servings_claimed, coalesce(v_food.quantity_unit, 'servings'),
    v_claim.pickup_time, v_food.available_until, v_food.available_until,
    coalesce(v_claim.notes, v_food.description),
    'awaiting_rider', v_pickup_code, v_drop_code
  )
  returning id into v_task_id;

  update public.ngo_claims
  set status = 'awaiting_rider',
      collection_method = 'ngo_delivery',
      pickup_code = v_pickup_code,
      updated_at = now()
  where id = p_claim_id;

  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
  values (
    v_claim.ngo_id,
    'claim_confirmed',
    'Delivery Task Created',
    'A rider delivery request was created for "' || v_food.title || '". Looking for a nearby rider.',
    jsonb_build_object('delivery_task_id', v_task_id, 'claim_id', p_claim_id),
    v_food.id, p_claim_id, v_task_id, '/my-claims'
  );

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
        'Pickup "' || v_food.title || '" (' || v_claim.servings_claimed || ' servings) -> ' || coalesce(v_ngo.organization_name, v_ngo.full_name) || ' • ' || v_rider_row.distance_km || ' km away',
        jsonb_build_object(
          'opportunity_type', 'delivery_task',
          'delivery_task_id', v_task_id,
          'food_listing_id', v_food.id,
          'title', v_food.title,
          'image_url', v_food.image_url,
          'servings', v_claim.servings_claimed,
          'distance_km', v_rider_row.distance_km,
          'available_until', v_food.available_until
        ),
        v_food.id, v_task_id, '/rider-dashboard'
      );
    end loop;
  end if;

  return v_task_id;
end;
$$;

-- ─── 4. Harden accept_delivery_job (auto-upsert rider record if missing) ────
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

  insert into public.riders (user_id, name, phone, is_online, is_available, id_verified)
  values (
    v_uid,
    coalesce(v_profile.full_name, 'ShareBite Rider'),
    v_profile.phone,
    true,
    true,
    coalesce(v_profile.is_verified, false)
  )
  on conflict (user_id) do nothing;

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

  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    'rider_assigned',
    'Rider Assigned to Your Donation',
    coalesce(v_rider.name, v_profile.full_name, 'A rider') || ' is heading to pick up "' || coalesce(v_task.food_title, 'food') || '".',
    jsonb_build_object('delivery_task_id', p_task_id, 'rider_id', v_rider.id),
    v_task.food_listing_id, p_task_id, '/donor-dashboard'
  );

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

-- ─── 5. Harden confirm_pickup (null-safe ngo_id + status history) ────────────
create or replace function public.confirm_pickup(
  p_task_id           uuid,
  p_pickup_code       text,
  p_servings_collected integer,
  p_discrepancy_notes text default null
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

  select * into v_task from public.delivery_tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found'; end if;

  if v_task.rider_id != v_rider.id then
    raise exception 'You are not assigned to this delivery';
  end if;

  if v_task.status not in ('rider_assigned', 'going_to_pickup') then
    raise exception 'Cannot confirm pickup in current status: %', v_task.status;
  end if;

  if lower(v_task.pickup_code) != lower(p_pickup_code) then
    raise exception 'Invalid pickup verification code';
  end if;

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

  if v_task.claim_id is not null then
    update public.ngo_claims
    set status = 'food_collected',
        collected_at = now(),
        servings_collected = p_servings_collected,
        updated_at = now()
    where id = v_task.claim_id;
  end if;

  update public.food_listings
  set status = 'picked_up', updated_at = now()
  where id = v_task.food_listing_id;

  insert into public.donation_status_history (
    food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_task.food_listing_id, p_task_id, v_task.claim_id, v_task.status::text, 'PICKED_UP', auth.uid(), 'rider',
    coalesce(p_discrepancy_notes, 'Pickup verified with donor code')
  );

  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    'food_collected',
    'Food Collected by Rider',
    'Your donated food "' || v_task.food_title || '" has been picked up and is on its way.',
    jsonb_build_object('delivery_task_id', p_task_id, 'servings_collected', p_servings_collected),
    v_task.food_listing_id, p_task_id, '/donations/' || v_task.food_listing_id
  );

  if v_task.ngo_id is not null then
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
    values (
      v_task.ngo_id,
      'food_collected',
      'Food Collected — In Transit',
      '"' || v_task.food_title || '" has been collected and is now in transit to your location.',
      jsonb_build_object('delivery_task_id', p_task_id),
      v_task.food_listing_id, p_task_id, '/my-claims'
    );
  end if;

  return true;
end;
$$;

-- ─── 6. New Workflow B RPC: ngo_confirm_pickup (Direct NGO Pickup) ───────────
drop function if exists public.ngo_confirm_pickup(uuid, integer, text);
create or replace function public.ngo_confirm_pickup(
  p_claim_id           uuid,
  p_servings_collected integer default null,
  p_notes              text default null
)
returns boolean
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid   uuid := auth.uid();
  v_claim public.ngo_claims%rowtype;
  v_food  public.food_listings%rowtype;
  v_qty   integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_claim from public.ngo_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found';
  end if;

  if v_claim.ngo_id <> v_uid then
    raise exception 'Only the claiming NGO can confirm direct pickup';
  end if;

  if coalesce(v_claim.collection_method, 'ngo_delivery') <> 'direct_ngo_pickup' then
    raise exception 'This claim uses rider delivery; rider confirms pickup with the donor code.';
  end if;

  if v_claim.status <> 'confirmed' then
    raise exception 'Cannot confirm direct pickup in status: %', v_claim.status;
  end if;

  if exists (
    select 1 from public.delivery_tasks
    where claim_id = p_claim_id and status not in ('cancelled')
  ) then
    raise exception 'An active rider delivery task already exists for this claim.';
  end if;

  select * into v_food from public.food_listings where id = v_claim.food_listing_id for update;
  if not found then
    raise exception 'Food donation not found';
  end if;

  v_qty := coalesce(p_servings_collected, v_claim.servings_claimed);

  update public.ngo_claims
  set status = 'food_collected',
      collected_at = now(),
      servings_collected = v_qty,
      notes = coalesce(p_notes, notes),
      updated_at = now()
  where id = p_claim_id;

  update public.food_listings
  set status = 'picked_up',
      updated_at = now()
  where id = v_claim.food_listing_id;

  insert into public.donation_status_history (
    food_listing_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_claim.food_listing_id, p_claim_id, v_food.status::text, 'PICKED_UP', v_uid, 'ngo',
    coalesce(p_notes, 'Food picked up directly by NGO ' || coalesce(v_claim.ngo_name, 'NGO'))
  );

  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, action_url)
  values (
    v_food.donor_id,
    'food_collected',
    'Food Picked Up Directly by NGO',
    coalesce(v_claim.ngo_name, 'The NGO') || ' has picked up "' || v_food.title || '" directly from your location.',
    jsonb_build_object('claim_id', p_claim_id, 'servings_collected', v_qty),
    v_food.id, p_claim_id, '/donations/' || v_food.id
  );

  return true;
end;
$$;

-- ─── 7. Upgrade confirm_ngo_receipt (Supports Rider Task OR Direct Claim) ────
drop function if exists public.confirm_ngo_receipt(uuid, numeric, text, boolean, text);
drop function if exists public.confirm_ngo_receipt(uuid, numeric, text, boolean, text, uuid);

create or replace function public.confirm_ngo_receipt(
  p_task_id           uuid default null,
  p_quantity_received numeric default 1,
  p_condition_notes   text default null,
  p_safety_concern    boolean default false,
  p_safety_notes      text default null,
  p_claim_id          uuid default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid     uuid := auth.uid();
  v_task    public.delivery_tasks%rowtype;
  v_claim   public.ngo_claims%rowtype;
  v_food    public.food_listings%rowtype;
  v_profile public.profiles%rowtype;
  v_dist_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'Profile not found';
  end if;

  if p_task_id is null and p_claim_id is null then
    raise exception 'Either p_task_id or p_claim_id is required to confirm receipt';
  end if;

  if p_task_id is not null then
    -- Workflow A: NGO confirms receipt from rider delivery task
    select * into v_task from public.delivery_tasks where id = p_task_id for update;
    if not found then
      raise exception 'Task not found';
    end if;

    if v_task.ngo_id != v_uid then
      raise exception 'Only the receiving NGO can confirm receipt';
    end if;

    if v_task.status not in ('delivered', 'food_collected', 'in_transit') then
      raise exception 'Cannot confirm receipt in status: %', v_task.status;
    end if;

    update public.delivery_tasks
    set status = 'completed',
        updated_at = now()
    where id = p_task_id;

    if v_task.claim_id is not null then
      update public.ngo_claims
      set status = 'delivered',
          delivered_at = now(),
          updated_at = now()
      where id = v_task.claim_id;
    end if;

    update public.food_listings
    set status = 'completed',
        updated_at = now()
    where id = v_task.food_listing_id;

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
      v_uid, v_uid,
      greatest(1, p_quantity_received), coalesce(v_task.quantity_unit, 'servings'),
      current_date,
      p_condition_notes, p_safety_concern, p_safety_notes,
      'pending', now()
    )
    returning id into v_dist_id;

    insert into public.impact_events (user_id, event_type, servings)
    values (v_uid, 'food_rescued', greatest(1, floor(p_quantity_received)::integer));

    insert into public.donation_status_history (
      food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
    ) values (
      v_task.food_listing_id, p_task_id, v_task.claim_id, v_task.status::text, 'DELIVERED', v_uid, 'ngo',
      'NGO confirmed receipt of food delivery'
    );

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
  else
    -- Workflow B: Direct NGO pickup receipt without rider delivery_task
    select * into v_claim from public.ngo_claims where id = p_claim_id for update;
    if not found then
      raise exception 'Claim not found';
    end if;

    if v_claim.ngo_id != v_uid then
      raise exception 'Only the receiving NGO can confirm receipt';
    end if;

    if exists (
      select 1 from public.delivery_tasks
      where claim_id = p_claim_id and status not in ('cancelled')
    ) then
      raise exception 'Use the delivery task confirmation flow while an active rider task exists';
    end if;

    if v_claim.status not in ('confirmed', 'food_collected') then
      raise exception 'Cannot confirm direct receipt in status: %', v_claim.status;
    end if;

    select * into v_food from public.food_listings where id = v_claim.food_listing_id for update;
    if not found then
      raise exception 'Food listing not found';
    end if;

    update public.ngo_claims
    set status = 'delivered',
        collected_at = coalesce(collected_at, now()),
        delivered_at = now(),
        servings_collected = coalesce(servings_collected, greatest(1, floor(p_quantity_received)::integer)),
        updated_at = now()
    where id = p_claim_id;

    update public.food_listings
    set status = 'completed',
        updated_at = now()
    where id = v_claim.food_listing_id;

    insert into public.distribution_records (
      food_listing_id, claim_id, delivery_task_id,
      ngo_id, recorded_by,
      quantity_received, quantity_unit,
      distribution_date,
      condition_notes, safety_concern, safety_notes,
      status, receipt_confirmed_at
    )
    values (
      v_claim.food_listing_id, p_claim_id, null,
      v_uid, v_uid,
      greatest(1, p_quantity_received), coalesce(v_food.quantity_unit, 'servings'),
      current_date,
      p_condition_notes, p_safety_concern, p_safety_notes,
      'pending', now()
    )
    returning id into v_dist_id;

    insert into public.impact_events (user_id, event_type, servings)
    values (v_uid, 'food_rescued', greatest(1, floor(p_quantity_received)::integer));

    insert into public.donation_status_history (
      food_listing_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
    ) values (
      v_claim.food_listing_id, p_claim_id, v_claim.status::text, 'DELIVERED', v_uid, 'ngo',
      'NGO confirmed direct pickup arrival at facility'
    );

    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, action_url)
    values (
      v_food.donor_id,
      'ngo_receipt_confirmed',
      'Food Received by NGO',
      coalesce(v_claim.ngo_name, 'The NGO') || ' has confirmed direct collection and receipt of "' || v_food.title || '"!',
      jsonb_build_object('claim_id', p_claim_id, 'quantity_received', p_quantity_received),
      v_food.id,
      p_claim_id,
      '/donations/' || v_food.id
    );

    return v_dist_id;
  end if;
end;
$$;

-- ─── 8. Recreate Dashboard Views with collection_method & direct pickup codes ─
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
  nc.collection_method,
  dt.id as delivery_task_id,
  dt.status as delivery_status,
  dt.assignment_type,
  dt.rider_id,
  r.user_id as rider_user_id,
  r.name as rider_name,
  r.phone as rider_phone,
  coalesce(dt.pickup_code, nc.pickup_code) as pickup_code,
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
  nc.collection_method,
  coalesce(dt.pickup_code, nc.pickup_code) as pickup_code,
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

-- ─── 9. Fix publish_food_donation & get_nearby_food for Enum Columns ────────
-- Ensures databases where food_listings.food_type / storage_type / category
-- are PostgreSQL enums never fail with "expression is of type text".
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
  where fl.status::text in ('available', 'partially_reserved')
    and fl.available_servings > 0
    and fl.available_until > now()
    and (
      p_lat is null or p_lng is null
      or (fl.latitude is not null and fl.longitude is not null and ST_DWithin(
        coalesce(fl.location, ST_SetSRID(ST_MakePoint(fl.longitude, fl.latitude), 4326)::geography),
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        least(greatest(p_radius_km, 1.0), 100.0) * 1000.0
      ))
    )
  order by distance_km asc nulls last, fl.created_at desc;
$$;

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

  insert into public.donations (food_listing_id, donor_id, servings, status)
  values (v_listing.id, v_uid, p_servings, 'active');

  insert into public.impact_events (user_id, event_type, servings)
  values (v_uid, 'food_donated', p_servings);

  insert into public.donation_status_history (
    food_listing_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_listing.id, null, 'AVAILABLE', v_uid, 'donor',
    'Published with ' || coalesce(p_notification_radius_km, 15.0) || ' km discovery radius'
  );

  for v_ngo in
    select * from public.find_nearby_ngos(p_latitude, p_longitude, coalesce(p_notification_radius_km, 15.0), true)
    where id <> v_uid
  loop
    insert into public.notifications (
      user_id, type, title, message, data, related_food_id, action_url
    ) values (
      v_ngo.id,
      'food_nearby',
      case when coalesce(p_is_urgent, false) then 'URGENT FOOD NEAR YOU!' else 'NEW FOOD AVAILABLE NEARBY!' end,
      p_servings || ' ' || coalesce(p_quantity_unit, 'servings') || ' of "' || p_title || '" in ' || v_approx_area || ' • ' || v_ngo.distance_km || ' km away',
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

  for v_rider in
    select * from public.find_nearby_riders(p_latitude, p_longitude, coalesce(p_notification_radius_km, 15.0))
    where user_id <> v_uid
  loop
    insert into public.notifications (
      user_id, type, title, message, data, related_food_id, action_url
    ) values (
      v_rider.user_id,
      'pickup_nearby',
      case when coalesce(p_is_urgent, false) then 'URGENT PICKUP OPPORTUNITY!' else 'PICKUP OPPORTUNITY NEARBY!' end,
      '"' || p_title || '" (' || p_servings || ' ' || coalesce(p_quantity_unit, 'servings') || ') in ' || v_approx_area || ' • ' || v_rider.distance_km || ' km away',
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

-- ─── 10. Explicit Function Grants & RLS Integrity Verification ───────────────
grant execute on function public.publish_food_donation(text, text, text, text, integer, text, text, text, double precision, double precision, double precision, timestamptz, timestamptz, timestamptz, boolean, text[], text, text, numeric, timestamptz, text, double precision) to authenticated;
grant execute on function public.get_nearby_food(double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.accept_donation(uuid, integer, timestamptz, text, text) to authenticated;
grant execute on function public.claim_food(uuid, integer, timestamptz, text) to authenticated;
grant execute on function public.create_delivery_task(uuid) to authenticated;
grant execute on function public.accept_delivery_job(uuid) to authenticated;
grant execute on function public.confirm_pickup(uuid, text, integer, text) to authenticated;
grant execute on function public.ngo_confirm_pickup(uuid, integer, text) to authenticated;
grant execute on function public.confirm_ngo_receipt(uuid, numeric, text, boolean, text, uuid) to authenticated;

-- ============================================================================
-- DONE ✓ Apply this file once in Supabase SQL Editor.
-- ============================================================================
