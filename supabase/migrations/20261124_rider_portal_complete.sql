-- ============================================================================
-- ShareBite: Complete Rider Portal, 8-Stage Delivery Status & Secure Chat SQL
-- Date: 2026-11-24
-- Additive & idempotent. Preserves Donor Portal, NGO Portal, and existing data.
-- ============================================================================

-- ─── 1. Extend delivery_task_status & notification_type Enums ────────────────
do $$ begin
  alter type public.delivery_task_status add value if not exists 'arrived_at_pickup';
exception when others then null; end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'new_message';
exception when others then null; end $$;

alter table public.delivery_tasks
  add column if not exists arrived_at_pickup_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.riders
  add column if not exists total_distance_km numeric(10,2) not null default 0;

-- ─── 2. Strict Conversation Access & Auto-Notification Trigger ───────────────
-- Helper: verifies caller is a conversation participant AND (for task-linked chats)
-- is strictly the Donor, currently assigned Rider, assigned NGO, or Admin.
create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
security definer
set search_path = public
language plpgsql
stable as $$
declare
  v_uid  uuid := auth.uid();
  v_conv public.conversations%rowtype;
  v_task public.delivery_tasks%rowtype;
begin
  if v_uid is null then
    return false;
  end if;

  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = v_uid
  ) then
    return false;
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if not found then
    return false;
  end if;

  if v_conv.related_task_id is not null then
    select * into v_task from public.delivery_tasks where id = v_conv.related_task_id;
    if found then
      return (
        v_task.donor_id = v_uid
        or v_task.ngo_id = v_uid
        or exists (
          select 1 from public.riders r
          where r.id = v_task.rider_id and r.user_id = v_uid
        )
        or public.get_auth_user_role() = 'admin'
      );
    end if;
  end if;

  return true;
end;
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conv_participant_select" on public.conversations;
create policy "conv_participant_select" on public.conversations
  for select to authenticated
  using (public.can_access_conversation(id));

drop policy if exists "conv_authenticated_insert" on public.conversations;
create policy "conv_authenticated_insert" on public.conversations
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "conv_participant_update" on public.conversations;
create policy "conv_participant_update" on public.conversations
  for update to authenticated
  using (public.can_access_conversation(id));

drop policy if exists "msg_select" on public.messages;
create policy "msg_select" on public.messages
  for select to authenticated
  using (public.can_access_conversation(conversation_id));

drop policy if exists "msg_insert" on public.messages;
create policy "msg_insert" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_access_conversation(conversation_id)
  );

drop policy if exists "msg_update_read" on public.messages;
create policy "msg_update_read" on public.messages
  for update to authenticated
  using (public.can_access_conversation(conversation_id));

-- Secure RPC: Get or create dedicated Donor <-> Assigned Rider conversation
drop function if exists public.get_or_create_delivery_conversation(uuid, uuid);
create or replace function public.get_or_create_delivery_conversation(
  p_food_listing_id  uuid,
  p_delivery_task_id uuid default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  v_uid           uuid := auth.uid();
  v_food          public.food_listings%rowtype;
  v_task          public.delivery_tasks%rowtype;
  v_rider_user_id uuid;
  v_conv_id       uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_food from public.food_listings where id = p_food_listing_id;
  if not found then
    raise exception 'Food donation not found';
  end if;

  if p_delivery_task_id is not null then
    select * into v_task from public.delivery_tasks where id = p_delivery_task_id;
  else
    select * into v_task
    from public.delivery_tasks
    where food_listing_id = p_food_listing_id
      and status not in ('cancelled')
    order by created_at desc
    limit 1;
  end if;

  if v_task.id is not null and v_task.rider_id is not null then
    select user_id into v_rider_user_id from public.riders where id = v_task.rider_id;
  elsif v_food.assigned_rider_id is not null then
    select user_id into v_rider_user_id from public.riders where id = v_food.assigned_rider_id;
  end if;

  if v_rider_user_id is null then
    raise exception 'No rider is currently assigned to this donation';
  end if;

  -- Strictly authorize ONLY the donor or the assigned rider (or assigned NGO / admin)
  if v_uid not in (v_food.donor_id, v_rider_user_id)
     and (v_task.ngo_id is null or v_uid <> v_task.ngo_id)
     and coalesce(public.get_auth_user_role(), '') <> 'admin' then
    raise exception 'Unauthorized: only the donor and assigned rider can access this conversation';
  end if;

  -- Look up existing delivery conversation for this task/listing containing both donor & rider
  select c.id into v_conv_id
  from public.conversations c
  where (
      (v_task.id is not null and c.related_task_id = v_task.id)
      or c.related_listing_id = p_food_listing_id
    )
    and exists (select 1 from public.conversation_participants cp1 where cp1.conversation_id = c.id and cp1.user_id = v_food.donor_id)
    and exists (select 1 from public.conversation_participants cp2 where cp2.conversation_id = c.id and cp2.user_id = v_rider_user_id)
  order by c.created_at desc
  limit 1;

  if v_conv_id is null then
    insert into public.conversations (type, related_listing_id, related_task_id, title, last_message_at)
    values ('delivery', p_food_listing_id, v_task.id, v_food.title, now())
    returning id into v_conv_id;

    insert into public.conversation_participants (conversation_id, user_id, role)
    values
      (v_conv_id, v_food.donor_id, 'donor'),
      (v_conv_id, v_rider_user_id, 'rider')
    on conflict (conversation_id, user_id) do nothing;
  end if;

  return v_conv_id;
end;
$$;

-- Trigger: Update conversation.last_message_at & send real-time chat notification
create or replace function public.handle_new_chat_message()
returns trigger
security definer
set search_path = public
language plpgsql as $$
declare
  v_sender_name text;
  v_conv        public.conversations%rowtype;
  v_part        record;
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = new.created_at
  where id = new.conversation_id
  returning * into v_conv;

  if new.message_type = 'system' then
    return new;
  end if;

  select coalesce(full_name, organization_name, 'ShareBite Partner')
  into v_sender_name
  from public.profiles
  where id = new.sender_id;

  for v_part in
    select user_id from public.conversation_participants
    where conversation_id = new.conversation_id
      and user_id <> new.sender_id
  loop
    begin
      insert into public.notifications (
        user_id, type, title, message, data, related_food_id, related_delivery_id, action_url
      ) values (
        v_part.user_id,
        'new_message',
        'New Message from ' || coalesce(v_sender_name, 'Partner'),
        left(new.content, 140),
        jsonb_build_object(
          'conversation_id', new.conversation_id,
          'message_id', new.id,
          'sender_id', new.sender_id
        ),
        v_conv.related_listing_id,
        v_conv.related_task_id,
        '/chat/' || new.conversation_id
      );
    exception when others then
      -- Fallback if enum value 'new_message' is not committed in same transaction
      insert into public.notifications (
        user_id, type, title, message, data, related_food_id, related_delivery_id, action_url
      ) values (
        v_part.user_id,
        'system',
        'New Message from ' || coalesce(v_sender_name, 'Partner'),
        left(new.content, 140),
        jsonb_build_object('conversation_id', new.conversation_id, 'sender_id', new.sender_id),
        v_conv.related_listing_id,
        v_conv.related_task_id,
        '/chat/' || new.conversation_id
      );
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_chat_message on public.messages;
create trigger trg_handle_new_chat_message
  after insert on public.messages
  for each row execute function public.handle_new_chat_message();

-- ─── 3. Upgrade accept_donation & accept_delivery_job to Create Chat + Distance ─
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
  v_conv_id           uuid;
  v_pickup_code       text;
  v_drop_code         text;
  v_servings          integer;
  v_est_km            numeric(8,2);
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

  if v_food.status::text not in ('available', 'partially_reserved') or v_food.available_servings <= 0 then
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

  -- ── BRANCH A: Verified NGO / Acceptor ──────────────────────────────────────
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
      v_collection_method, v_pickup_code, p_pickup_time, p_notes,
      coalesce(v_profile.organization_name, v_profile.full_name, 'Verified NGO'), now()
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
      v_est_km := case
        when v_food.latitude is not null and v_food.longitude is not null
             and v_profile.latitude is not null and v_profile.longitude is not null
        then round(public.calculate_distance_km(v_food.latitude, v_food.longitude, v_profile.latitude, v_profile.longitude)::numeric, 2)
        else null
      end;

      insert into public.delivery_tasks (
        food_listing_id, claim_id, reservation_id,
        donor_id, ngo_id, assignment_type,
        pickup_address, pickup_lat, pickup_lng,
        dropoff_address, dropoff_lat, dropoff_lng,
        food_title, servings_required, quantity_unit,
        pickup_window_start, pickup_window_end, collection_deadline,
        instructions, estimated_km, status, pickup_code, dropoff_code
      )
      values (
        p_food_listing_id, v_claim_id, v_res_id,
        v_food.donor_id, v_uid, 'ngo_delivery',
        v_food.pickup_address, v_food.latitude, v_food.longitude,
        coalesce(v_profile.address, v_profile.city), v_profile.latitude, v_profile.longitude,
        v_food.title, v_servings, coalesce(v_food.quantity_unit, 'servings'),
        p_pickup_time, v_food.available_until, v_food.available_until,
        coalesce(p_notes, v_food.description), v_est_km, 'awaiting_rider', v_pickup_code, v_drop_code
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
      'Accepted by NGO ' || coalesce(v_profile.organization_name, v_profile.full_name)
    );

    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
    values (
      v_food.donor_id,
      'donation_claimed',
      case when v_collection_method = 'direct_ngo_pickup' then 'NGO Accepted Your Donation (Direct Pickup)!' else 'NGO Accepted Your Donation!' end,
      coalesce(v_profile.organization_name, v_profile.full_name, 'An NGO') || ' accepted "' || v_food.title || '".',
      jsonb_build_object('food_listing_id', p_food_listing_id, 'claim_id', v_claim_id, 'delivery_task_id', v_task_id, 'collection_method', v_collection_method),
      p_food_listing_id, v_claim_id, v_task_id, '/donor-dashboard'
    );

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
          'Pickup "' || v_food.title || '" (' || v_servings || ' servings) • ' || v_rider_row.distance_km || ' km away',
          jsonb_build_object('opportunity_type', 'delivery_task', 'delivery_task_id', v_task_id, 'food_listing_id', p_food_listing_id, 'title', v_food.title, 'servings', v_servings, 'distance_km', v_rider_row.distance_km),
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

  -- ── BRANCH B: Rider Accepts Pickup (First-Accept-Wins) ─────────────────────
  elsif v_profile.role::text in ('rider', 'volunteer') then
    insert into public.riders (user_id, name, phone, is_online, is_available, id_verified)
    values (
      v_uid,
      coalesce(v_profile.full_name, 'ShareBite Rider'),
      coalesce(v_profile.phone, ''),
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

    if exists (
      select 1 from public.ngo_claims
      where food_listing_id = p_food_listing_id
        and status not in ('cancelled', 'expired')
    ) then
      raise exception 'ALREADY_CLAIMED: An NGO has already claimed this donation. Accept the delivery job from Available Pickups instead.';
    end if;

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
      v_est_km := round(public.calculate_distance_km(v_food.latitude, v_food.longitude, v_matched_ngo.latitude, v_matched_ngo.longitude)::numeric, 2);

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
        collection_deadline, instructions, estimated_km, status, pickup_code, dropoff_code, rider_assigned_at
      )
      values (
        p_food_listing_id, v_claim_id, v_res_id,
        v_rider.id, v_food.donor_id, v_matched_ngo.id, 'ngo_delivery',
        v_food.pickup_address, v_food.latitude, v_food.longitude,
        coalesce(v_matched_ngo.address, v_matched_ngo.city, 'Partner NGO'),
        v_matched_ngo.latitude, v_matched_ngo.longitude,
        v_food.title, v_food.available_servings, coalesce(v_food.quantity_unit, 'servings'),
        v_food.available_until, coalesce(p_notes, v_food.description), v_est_km,
        'rider_assigned', v_pickup_code, v_drop_code, now()
      )
      returning id into v_task_id;
    else
      v_claim_id := null;
      v_est_km := case
        when v_food.latitude is not null and v_food.longitude is not null
             and v_rider.current_lat is not null and v_rider.current_lng is not null
        then round(public.calculate_distance_km(v_rider.current_lat, v_rider.current_lng, v_food.latitude, v_food.longitude)::numeric, 2)
        else null
      end;

      insert into public.delivery_tasks (
        food_listing_id, rider_id, donor_id, ngo_id, assignment_type,
        pickup_address, pickup_lat, pickup_lng,
        dropoff_address, food_title, servings_required, quantity_unit,
        collection_deadline, instructions, estimated_km, status, pickup_code, dropoff_code, rider_assigned_at
      )
      values (
        p_food_listing_id, v_rider.id, v_food.donor_id, null, 'rider_direct_pickup',
        v_food.pickup_address, v_food.latitude, v_food.longitude,
        'Community Distribution / Partner Shelter', v_food.title, v_food.available_servings, coalesce(v_food.quantity_unit, 'servings'),
        v_food.available_until, coalesce(p_notes, v_food.description), v_est_km,
        'rider_assigned', v_pickup_code, v_drop_code, now()
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
    set is_available = false, is_online = true, updated_at = now()
    where id = v_rider.id;

    -- Atomically create Donor <-> Rider conversation channel
    insert into public.conversations (type, related_listing_id, related_task_id, title, last_message_at)
    values ('delivery', p_food_listing_id, v_task_id, v_food.title, now())
    returning id into v_conv_id;

    insert into public.conversation_participants (conversation_id, user_id, role)
    values
      (v_conv_id, v_food.donor_id, 'donor'),
      (v_conv_id, v_uid, 'rider')
    on conflict (conversation_id, user_id) do nothing;

    insert into public.messages (conversation_id, sender_id, content, message_type)
    values (
      v_conv_id,
      v_uid,
      'Rider ' || coalesce(nullif(v_rider.name, ''), v_profile.full_name, 'Partner') || ' accepted your food pickup "' || v_food.title || '".',
      'system'
    );

    insert into public.donation_status_history (
      food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
    ) values (
      p_food_listing_id, v_task_id, v_claim_id, v_food.status::text, 'ACCEPTED', v_uid, 'rider',
      'Accepted by rider ' || coalesce(nullif(v_rider.name, ''), v_profile.full_name)
    );

    -- Notify Donor
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
    values (
      v_food.donor_id,
      'rider_assigned',
      'Rider Accepted Your Pickup!',
      coalesce(nullif(v_rider.name, ''), v_profile.full_name, 'A ShareBite rider') || ' accepted "' || v_food.title || '" and is preparing to head to your location.',
      jsonb_build_object(
        'food_listing_id', p_food_listing_id,
        'delivery_task_id', v_task_id,
        'rider_id', v_rider.id,
        'conversation_id', v_conv_id
      ),
      p_food_listing_id, v_claim_id, v_task_id, '/donor-donations'
    );

    if v_has_matched_ngo then
      insert into public.notifications (user_id, type, title, message, data, related_food_id, related_claim_id, related_delivery_id, action_url)
      values (
        v_matched_ngo.id,
        'rider_assigned',
        'Incoming Delivery Assigned to Your NGO!',
        coalesce(nullif(v_rider.name, ''), v_profile.full_name, 'A rider') || ' accepted "' || v_food.title || '" and will deliver it to your NGO.',
        jsonb_build_object('food_listing_id', p_food_listing_id, 'delivery_task_id', v_task_id, 'claim_id', v_claim_id),
        p_food_listing_id, v_claim_id, v_task_id, '/my-claims'
      );
    end if;

    return jsonb_build_object(
      'accepted_by', 'rider',
      'claim_id', v_claim_id,
      'delivery_task_id', v_task_id,
      'conversation_id', v_conv_id,
      'pickup_lat', v_food.latitude,
      'pickup_lng', v_food.longitude,
      'pickup_address', v_food.pickup_address,
      'status', 'rider_assigned'
    );
  else
    raise exception 'Only verified NGOs or riders can accept food donations';
  end if;
end;
$$;

-- Upgrade accept_delivery_job to also create Donor <-> Rider conversation
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
  v_conv_id uuid;
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
    coalesce(v_profile.phone, ''),
    true,
    true,
    coalesce(v_profile.is_verified, false)
  )
  on conflict (user_id) do nothing;

  select * into v_rider from public.riders where user_id = v_uid for update;
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
  set is_available = false, is_online = true, updated_at = now()
  where id = v_rider.id;

  update public.food_listings
  set assigned_rider_id = v_rider.id, updated_at = now()
  where id = v_task.food_listing_id;

  if v_task.claim_id is not null then
    update public.ngo_claims
    set status = 'rider_assigned', rider_assigned_at = now(), updated_at = now()
    where id = v_task.claim_id;
  end if;

  insert into public.conversations (type, related_listing_id, related_task_id, title, last_message_at)
  values ('delivery', v_task.food_listing_id, p_task_id, coalesce(v_task.food_title, 'Food Pickup'), now())
  returning id into v_conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (v_conv_id, v_task.donor_id, 'donor'),
    (v_conv_id, v_uid, 'rider')
  on conflict (conversation_id, user_id) do nothing;

  insert into public.messages (conversation_id, sender_id, content, message_type)
  values (
    v_conv_id,
    v_uid,
    'Rider ' || coalesce(nullif(v_rider.name, ''), v_profile.full_name, 'Partner') || ' accepted your delivery task.',
    'system'
  );

  insert into public.donation_status_history (
    food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_task.food_listing_id, p_task_id, v_task.claim_id, 'awaiting_rider', 'ACCEPTED', v_uid, 'rider',
    'Assigned to rider ' || coalesce(nullif(v_rider.name, ''), v_profile.full_name)
  );

  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    'rider_assigned',
    'Rider Assigned to Your Donation',
    coalesce(nullif(v_rider.name, ''), v_profile.full_name, 'A rider') || ' is assigned to pick up "' || coalesce(v_task.food_title, 'food') || '".',
    jsonb_build_object('delivery_task_id', p_task_id, 'rider_id', v_rider.id, 'conversation_id', v_conv_id),
    v_task.food_listing_id, p_task_id, '/donor-donations'
  );

  if v_task.ngo_id is not null then
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
    values (
      v_task.ngo_id,
      'rider_assigned',
      'Rider Assigned to Your Claim',
      coalesce(nullif(v_rider.name, ''), v_profile.full_name, 'A rider') || ' accepted delivery of "' || coalesce(v_task.food_title, 'food') || '".',
      jsonb_build_object('delivery_task_id', p_task_id, 'rider_id', v_rider.id),
      v_task.food_listing_id, p_task_id, '/my-claims'
    );
  end if;

  return true;
end;
$$;

-- ─── 4. Full 8-Stage Delivery Status Machine (update_donation_status) ────────
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
  v_uid          uuid := auth.uid();
  v_task         public.delivery_tasks%rowtype;
  v_rider        public.riders%rowtype;
  v_role         text;
  v_allowed      boolean := false;
  v_status_title text;
  v_status_msg   text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_task from public.delivery_tasks where id = p_task_id for update;
  if not found then
    raise exception 'Delivery task not found';
  end if;

  select * into v_rider from public.riders where user_id = v_uid;
  v_role := public.get_auth_user_role();

  if not (
    v_role = 'admin'
    or (v_rider.id is not null and v_task.rider_id = v_rider.id)
    or v_task.donor_id = v_uid
    or v_task.ngo_id = v_uid
  ) then
    raise exception 'Not authorised to update this delivery status';
  end if;

  -- Allowed workflow transitions:
  -- ACCEPTED (rider_assigned) -> ON THE WAY TO DONOR (going_to_pickup) -> ARRIVED AT PICKUP (arrived_at_pickup)
  -- -> FOOD COLLECTED (food_collected) -> ON THE WAY TO DESTINATION (in_transit) -> DELIVERED (delivered) -> COMPLETED (completed)
  if v_task.status::text = 'rider_assigned' and p_new_status in ('going_to_pickup', 'arrived_at_pickup', 'food_collected', 'incident') then v_allowed := true; end if;
  if v_task.status::text = 'going_to_pickup' and p_new_status in ('arrived_at_pickup', 'food_collected', 'incident') then v_allowed := true; end if;
  if v_task.status::text = 'arrived_at_pickup' and p_new_status in ('food_collected', 'incident') then v_allowed := true; end if;
  if v_task.status::text = 'food_collected' and p_new_status in ('in_transit', 'delivered', 'incident') then v_allowed := true; end if;
  if v_task.status::text = 'in_transit' and p_new_status in ('delivered', 'completed', 'incident') then v_allowed := true; end if;
  if v_task.status::text = 'delivered' and p_new_status in ('completed') then v_allowed := true; end if;
  if v_role = 'admin' then v_allowed := true; end if;

  if not v_allowed then
    raise exception 'Invalid status transition from % to %', v_task.status, p_new_status;
  end if;

  -- Persist delivery_tasks status & milestone timestamps
  update public.delivery_tasks
  set
    status = p_new_status::public.delivery_task_status,
    arrived_at_pickup_at = case when p_new_status = 'arrived_at_pickup' then coalesce(arrived_at_pickup_at, now()) else arrived_at_pickup_at end,
    pickup_confirmed_at = case when p_new_status = 'food_collected' then coalesce(pickup_confirmed_at, now()) else pickup_confirmed_at end,
    pickup_confirmed_by = case when p_new_status = 'food_collected' then coalesce(pickup_confirmed_by, v_uid) else pickup_confirmed_by end,
    servings_collected = case when p_new_status = 'food_collected' then coalesce(servings_collected, servings_required) else servings_collected end,
    delivery_confirmed_at = case when p_new_status in ('delivered', 'completed') then coalesce(delivery_confirmed_at, now()) else delivery_confirmed_at end,
    delivery_confirmed_by = case when p_new_status in ('delivered', 'completed') then coalesce(delivery_confirmed_by, v_uid) else delivery_confirmed_by end,
    servings_delivered = case when p_new_status in ('delivered', 'completed') then coalesce(servings_delivered, servings_collected, servings_required) else servings_delivered end,
    completed_at = case when p_new_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
    updated_at = now()
  where id = p_task_id;

  -- Synchronize food_listings, ngo_claims, and rider metrics
  if p_new_status = 'food_collected' then
    update public.food_listings
    set status = 'picked_up', updated_at = now()
    where id = v_task.food_listing_id;

    if v_task.claim_id is not null then
      update public.ngo_claims
      set status = 'food_collected', collected_at = coalesce(collected_at, now()), updated_at = now()
      where id = v_task.claim_id;
    end if;
  elsif p_new_status = 'in_transit' and v_task.claim_id is not null then
    update public.ngo_claims
    set status = 'in_transit', updated_at = now()
    where id = v_task.claim_id;
  elsif p_new_status = 'delivered' then
    if v_task.claim_id is not null then
      update public.ngo_claims
      set status = 'delivered', delivered_at = coalesce(delivered_at, now()), updated_at = now()
      where id = v_task.claim_id;
    end if;
    -- Free rider on delivery dropoff if NGO handoff awaits NGO receipt confirmation
    if v_task.ngo_id is not null and v_task.rider_id is not null and v_task.delivery_confirmed_at is null then
      update public.riders
      set is_available = true,
          total_deliveries = total_deliveries + 1,
          total_distance_km = total_distance_km + coalesce(v_task.estimated_km, 0),
          updated_at = now()
      where id = v_task.rider_id;
    end if;
  elsif p_new_status = 'completed' then
    update public.food_listings
    set status = 'completed', updated_at = now()
    where id = v_task.food_listing_id;

    if v_task.claim_id is not null then
      update public.ngo_claims
      set status = 'delivered', delivered_at = coalesce(delivered_at, now()), updated_at = now()
      where id = v_task.claim_id;
    end if;

    if v_task.rider_id is not null and v_task.delivery_confirmed_at is null then
      update public.riders
      set is_available = true,
          total_deliveries = total_deliveries + 1,
          total_distance_km = total_distance_km + coalesce(v_task.estimated_km, 0),
          updated_at = now()
      where id = v_task.rider_id;
    elsif v_task.rider_id is not null then
      update public.riders
      set is_available = true, updated_at = now()
      where id = v_task.rider_id;
    end if;

    insert into public.impact_events (user_id, event_type, servings)
    values (v_uid, 'food_rescued', coalesce(v_task.servings_delivered, v_task.servings_required, 1));
  end if;

  v_status_title := case p_new_status
    when 'going_to_pickup'   then 'Rider is On the Way to Pickup'
    when 'arrived_at_pickup' then 'Rider Has Arrived at Your Location'
    when 'food_collected'    then 'Food Collected by Rider'
    when 'in_transit'        then 'Food is On the Way to Destination'
    when 'delivered'         then 'Food Delivered!'
    when 'completed'         then 'Delivery Completed!'
    else 'Delivery Status Updated'
  end;

  v_status_msg := '"' || coalesce(v_task.food_title, 'Your food donation') || '" status: ' || replace(initcap(replace(p_new_status, '_', ' ')), 'Ngo', 'NGO') || '.';

  insert into public.donation_status_history (
    food_listing_id, delivery_task_id, claim_id, previous_status, new_status, changed_by, actor_role, notes
  ) values (
    v_task.food_listing_id, p_task_id, v_task.claim_id, v_task.status::text, upper(p_new_status), v_uid, coalesce(v_role, 'rider'), p_notes
  );

  insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
  values (
    v_task.donor_id,
    case
      when p_new_status = 'going_to_pickup' then 'pickup_started'::public.notification_type
      when p_new_status = 'food_collected' then 'food_collected'::public.notification_type
      when p_new_status in ('delivered', 'completed') then 'delivery_completed'::public.notification_type
      else 'system'::public.notification_type
    end,
    v_status_title,
    v_status_msg,
    jsonb_build_object('delivery_task_id', p_task_id, 'status', p_new_status),
    v_task.food_listing_id, p_task_id, '/donor-donations'
  );

  if v_task.ngo_id is not null then
    insert into public.notifications (user_id, type, title, message, data, related_food_id, related_delivery_id, action_url)
    values (
      v_task.ngo_id,
      case when p_new_status in ('delivered', 'completed') then 'delivery_completed'::public.notification_type else 'system'::public.notification_type end,
      v_status_title,
      v_status_msg,
      jsonb_build_object('delivery_task_id', p_task_id, 'status', p_new_status),
      v_task.food_listing_id, p_task_id, '/my-claims'
    );
  end if;

  return true;
end;
$$;

-- ─── 5. Update rider_tasks_view with arrived_at_pickup_at & completed_at ─────
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
  dt.arrived_at_pickup_at,
  dt.pickup_confirmed_at,
  dt.pickup_confirmed_by,
  dt.servings_collected,
  dt.collection_discrepancy,
  dt.delivery_confirmed_at,
  dt.delivery_confirmed_by,
  dt.servings_delivered,
  dt.completed_at,
  dt.incident_reported,
  dt.incident_type,
  dt.incident_notes,
  dt.incident_at,
  dt.instructions,
  dt.estimated_km,
  dt.rider_assigned_at,
  dt.created_at,
  dt.updated_at,
  fl.food_type::text as food_type,
  fl.category::text as category,
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

-- ─── 6. Riders Self-Update RLS Policy Check ──────────────────────────────────
alter table public.riders enable row level security;

drop policy if exists "riders_own_insert" on public.riders;
create policy "riders_own_insert" on public.riders
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "riders_own_update" on public.riders;
create policy "riders_own_update" on public.riders
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant execute on function public.can_access_conversation(uuid) to authenticated;
grant execute on function public.get_or_create_delivery_conversation(uuid, uuid) to authenticated;
grant execute on function public.accept_donation(uuid, integer, timestamptz, text, text) to authenticated;
grant execute on function public.accept_delivery_job(uuid) to authenticated;
grant execute on function public.update_donation_status(uuid, text, text) to authenticated;

-- ============================================================================
-- DONE ✓ ShareBite Rider Portal & Donor Integration SQL Ready
-- ============================================================================
