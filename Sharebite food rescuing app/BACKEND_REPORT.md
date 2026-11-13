# 🗄️ Sharebite — Complete Backend Report

> Deep-dive technical documentation of the entire backend system powering Sharebite — database, security, RPCs, triggers, realtime, edge functions, and service architecture.

---

## 📋 Table of Contents

1. [Backend Overview](#-backend-overview)
2. [Supabase Services Used](#-supabase-services-used)
3. [Database Schema (All Tables)](#-database-schema-all-tables)
4. [Enums & Custom Types](#-enums--custom-types)
5. [Database Indexes](#-database-indexes)
6. [Triggers & Auto-Functions](#-triggers--auto-functions)
7. [PostgreSQL RPC Functions](#-postgresql-rpc-functions)
8. [Row-Level Security (RLS) Policies](#-row-level-security-rls-policies)
9. [Real-time Subscriptions](#-real-time-subscriptions)
10. [Edge Functions (Deno)](#-edge-functions-deno)
11. [Supabase Storage](#-supabase-storage)
12. [Authentication System](#-authentication-system)
13. [Service Layer (TypeScript)](#-service-layer-typescript)
14. [Migration History](#-migration-history)
15. [Backend Security Summary](#-backend-security-summary)
16. [Environment Variables](#-environment-variables)

---

## 🏛️ Backend Overview

Sharebite uses **Supabase** as a fully managed Backend-as-a-Service (BaaS) built on:

```
┌──────────────────────────────────────────────────────────────────┐
│                      SUPABASE PLATFORM                           │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │   GoTrue Auth   │  │   PostgreSQL 15  │  │  Supabase      │  │
│  │  (JWT + OAuth)  │  │   + pgcrypto     │  │  Storage       │  │
│  │                 │  │   + RLS          │  │  (S3-compat)   │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬────────┘  │
│           │                   │                     │           │
│  ┌────────▼──────────────────▼─────────────────────▼────────┐  │
│  │               PostgREST  (Auto REST API)                   │  │
│  │    Every table becomes a REST endpoint automatically       │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │          Supabase Realtime (Elixir Phoenix WebSocket)      │  │
│  │     Broadcasts DB changes to subscribed clients (CDC)      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │          Supabase Edge Functions (Deno Runtime)            │  │
│  │     Server-side logic without exposing API keys            │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Key Design Principle:** The frontend communicates directly with Supabase via the `@supabase/supabase-js` SDK. All authorization is enforced at the **database level** via RLS — not in the application layer.

---

## 🔧 Supabase Services Used

| Service | Purpose | Technology |
|---------|---------|-----------|
| **PostgreSQL 15** | Primary relational database | PostgreSQL + pgcrypto |
| **GoTrue** | Authentication & JWT token management | Go |
| **PostgREST** | Auto-generated REST API from schema | PostgREST |
| **Realtime** | WebSocket-based live data subscriptions | Elixir / Phoenix |
| **Storage** | File storage (images, documents) | S3-compatible |
| **Edge Functions** | Serverless Deno functions | Deno (TypeScript) |
| **Row Level Security** | Per-row access control | PostgreSQL RLS |

---

## 🗃️ Database Schema (All Tables)

### Table 1 — `profiles`
> User accounts for all roles. Linked to `auth.users` via FK.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, FK → auth.users | User ID (Supabase Auth) |
| `full_name` | text | — | Display name |
| `email` | text | — | Email address |
| `phone` | text | — | Phone number |
| `avatar_url` | text | — | Profile photo URL |
| `role` | user_role enum | NOT NULL, default 'receiver' | User's platform role |
| `bio` | text | — | About/bio text |
| `address` | text | — | Street address |
| `city` | text | — | City name |
| `latitude` | double | — | GPS latitude |
| `longitude` | double | — | GPS longitude |
| `is_verified` | boolean | NOT NULL, default false | Admin-verified flag |
| `push_token` | text | — | Expo push notification token |
| `total_donations` | integer | NOT NULL, default 0 | Lifetime donations count |
| `total_rescues` | integer | NOT NULL, default 0 | Lifetime rescues count |
| `created_at` | timestamptz | NOT NULL, default now() | Account creation time |
| `updated_at` | timestamptz | NOT NULL, default now() | Last update (auto-trigger) |

---

### Table 2 — `food_listings`
> Core table. Every food donation posted by a donor.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Listing ID |
| `donor_id` | uuid | FK → profiles, CASCADE | Who posted it |
| `title` | text | NOT NULL | Food name |
| `description` | text | — | Details |
| `category` | text | NOT NULL | Food category |
| `food_type` | text | CHECK (veg/non_veg/vegan/other) | Dietary type |
| `packaging_type` | text | CHECK enum | How food is packaged |
| `servings` | integer | NOT NULL, CHECK > 0 | Total servings |
| `available_servings` | integer | NOT NULL, CHECK >= 0 | Remaining (decrements on claim) |
| `image_url` | text | — | Photo URL (Supabase Storage) |
| `pickup_address` | text | — | Pickup location address |
| `city` | text | — | City |
| `latitude` | double | — | Pickup GPS lat |
| `longitude` | double | — | Pickup GPS lng |
| `available_from` | timestamptz | NOT NULL | Pickup window start |
| `available_until` | timestamptz | NOT NULL | Auto-expires at this time |
| `status` | food_status enum | NOT NULL, default 'available' | Current status |
| `is_urgent` | boolean | NOT NULL, default false | Urgency flag |
| `moderation_status` | text | NOT NULL, default 'pending' | AI moderation result |
| `image_hash` | text | — | SHA-256 for duplicate detection |
| `created_at` | timestamptz | NOT NULL | Creation time |
| `updated_at` | timestamptz | NOT NULL | Auto-updated via trigger |

**Constraints:**
```sql
CHECK (available_until > available_from)        -- valid time window
CHECK (available_servings <= servings)           -- can't exceed total
```

---

### Table 3 — `reservations`
> NGO/acceptor claims on food listings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Reservation ID |
| `food_listing_id` | uuid | FK → food_listings (CASCADE) |
| `user_id` | uuid | FK → profiles (the NGO) |
| `servings` | integer | Servings claimed |
| `status` | reservation_status enum | Lifecycle status |
| `pickup_time` | timestamptz | Scheduled pickup time |
| `notes` | text | NGO notes to donor |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | Auto-updated via trigger |

---

### Table 4 — `donations`
> Records of completed donation events.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Donation record ID |
| `food_listing_id` | uuid | FK → food_listings |
| `donor_id` | uuid | FK → profiles |
| `servings` | integer | Servings in this donation |
| `status` | text | active / partially_rescued / rescued / completed / cancelled / expired |
| `created_at` | timestamptz | — |
| `completed_at` | timestamptz | Completion timestamp |

---

### Table 5 — `riders`
> Rider-specific profile data (extends `profiles`).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Rider profile ID |
| `user_id` | uuid | FK → auth.users (UNIQUE) |
| `name` | text | Display name |
| `phone` | text | Contact number |
| `vehicle_type` | vehicle_type enum | bike/motorcycle/bicycle/scooter/car |
| `vehicle_number` | text | License plate |
| `profile_image` | text | Photo URL |
| `id_document_url` | text | ID verification document |
| `id_verified` | boolean | Admin-verified identity |
| `current_lat` | double | Live GPS latitude |
| `current_lng` | double | Live GPS longitude |
| `is_online` | boolean | Online status |
| `is_available` | boolean | Ready to accept tasks |
| `rating` | numeric(3,2) | Average rating (default 5.00) |
| `total_deliveries` | integer | Lifetime deliveries |
| `total_earnings` | integer | Total earnings (paise) |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | Auto-updated via trigger |

---

### Table 6 — `deliveries`
> Delivery task assignments and tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Delivery ID |
| `food_post_id` | uuid | FK → food_listings |
| `donor_id` | uuid | FK → auth.users |
| `receiver_id` | uuid | FK → auth.users (NGO) |
| `rider_id` | uuid | FK → riders |
| `pickup_lat/lng` | double | Pickup GPS coordinates |
| `pickup_address` | text | Pickup address string |
| `drop_lat/lng` | double | Dropoff GPS coordinates |
| `drop_address` | text | Dropoff address string |
| `food_name` | text | Food description |
| `food_quantity` | text | Quantity description |
| `status` | delivery_status enum | SEARCHING_RIDER → COMPLETED |
| `rider_assigned_at` | timestamptz | When rider was assigned |
| `arrived_at_pickup` | timestamptz | Rider arrived at donor |
| `picked_up_at` | timestamptz | Food collected timestamp |
| `delivered_at` | timestamptz | Delivered to NGO |
| `completed_at` | timestamptz | Fully confirmed |
| `cancelled_at` | timestamptz | — |
| `cancel_reason` | text | Why cancelled |
| `is_self_pickup` | boolean | NGO picks up themselves |

---

### Table 7 — `rider_ratings`
> Star ratings given after each delivery.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `delivery_id` | uuid | FK → deliveries |
| `rider_id` | uuid | FK → riders |
| `rater_id` | uuid | FK → auth.users |
| `rating` | smallint | CHECK BETWEEN 1 AND 5 |
| `comment` | text | — |
| `created_at` | timestamptz | — |
| — | — | UNIQUE(delivery_id, rater_id) |

---

### Table 8 — `rider_location_updates`
> Live GPS location trail for active deliveries.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Record ID |
| `rider_id` | uuid | Which rider |
| `delivery_task_id` | uuid | Active delivery |
| `latitude` | double | GPS latitude |
| `longitude` | double | GPS longitude |
| `heading` | double | Direction (degrees) |
| `speed` | double | Speed (m/s) |
| `recorded_at` | timestamptz | Timestamp |

---

### Table 9 — `conversations`
> Real-time chat conversation threads.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Conversation ID |
| `type` | text | direct / donation / delivery |
| `related_listing_id` | uuid | Linked food listing (optional) |
| `related_task_id` | uuid | Linked delivery task (optional) |
| `title` | text | Conversation title |
| `last_message_at` | timestamptz | Last activity |
| `created_at` | timestamptz | — |
| `updated_at` | timestamptz | — |

---

### Table 10 — `conversation_participants`
> Members of each conversation.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `conversation_id` | uuid | FK → conversations |
| `user_id` | uuid | FK → profiles |
| `role` | text | 'member' default |
| `last_read_at` | timestamptz | For unread count |
| — | — | UNIQUE(conversation_id, user_id) |

---

### Table 11 — `messages`
> Individual chat messages.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `conversation_id` | uuid | FK → conversations |
| `sender_id` | uuid | FK → profiles |
| `content` | text | NOT NULL |
| `message_type` | text | CHECK text/image/location/system |
| `metadata` | jsonb | Extra data (location coords, etc.) |
| `is_read` | boolean | NOT NULL, default false |
| `created_at` | timestamptz | — |

---

### Table 12 — `notifications`
> In-app notification log per user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | — |
| `user_id` | uuid | Recipient |
| `type` | notification_type enum | Notification category |
| `title` | text | Notification title |
| `message` | text | Body text |
| `data` | jsonb | Extra payload (IDs, links) |
| `related_food_id` | uuid | Linked listing |
| `related_reservation_id` | uuid | Linked reservation |
| `related_claim_id` | uuid | Linked claim |
| `related_delivery_id` | uuid | Linked delivery |
| `action_url` | text | Deep link |
| `is_read` | boolean | Read/unread status |
| `created_at` | timestamptz | — |

---

### Table 13 — `impact_events`
> Tracks every food rescue event for impact reporting.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | — |
| `user_id` | uuid | Who triggered it |
| `reservation_id` | uuid | Linked reservation |
| `donation_id` | uuid | Linked donation |
| `event_type` | text | food_donated / food_reserved / food_picked_up / food_rescued |
| `servings` | integer | Meals impacted |
| `created_at` | timestamptz | — |

---

### Table 14 — `food_moderation`
> AI image moderation queue and results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | — |
| `food_post_id` | uuid | Linked listing |
| `user_id` | uuid | Uploader |
| `image_url` | text | Image location |
| `image_hash` | text | SHA-256 for duplicate detection |
| `moderation_status` | moderation_status enum | pending/approved/rejected/manual_review |
| `ai_decision` | text | AI verdict |
| `is_food` | boolean | Is it food? |
| `is_spam` | boolean | Spam/fake? |
| `is_screenshot` | boolean | Screenshot/meme? |
| `is_advertisement` | boolean | Ad/banner? |
| `is_duplicate` | boolean | Same image uploaded before? |
| `quality_score` | numeric(4,3) | 0.0–1.0 image quality |
| `confidence` | numeric(4,3) | 0.0–1.0 AI confidence |
| `ai_reason` | text | Human-readable explanation |
| `ai_labels` | text[] | Top model labels |
| `duplicate_of` | uuid | FK → food_moderation (if duplicate) |
| `admin_override_by` | uuid | Admin who overrode AI |
| `admin_notes` | text | Manual review notes |
| `moderated_at` | timestamptz | When moderation ran |

---

### Table 15 — `partners`
> Verified partner organizations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | — |
| `profile_id` | uuid | FK → profiles (UNIQUE) |
| `organization_name` | text | NOT NULL |
| `organization_type` | text | restaurant/hostel/ngo/community_kitchen/farmer/organization/other |
| `description` | text | — |
| `address` | text | — |
| `city` | text | — |
| `latitude/longitude` | double | — |
| `logo_url` | text | — |
| `is_verified` | boolean | Admin-verified |

---

### Table 16 — `volunteer_tasks`
> Task board for volunteers (non-rider).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | — |
| `title` | text | Task name |
| `task_type` | text | pickup_delivery / food_distribution / sorting_packing / event_support / other |
| `status` | text | AVAILABLE / ASSIGNED / IN_PROGRESS / COMPLETED / CANCELLED |
| `ngo_id` | uuid | Posting NGO |
| `donation_id` | uuid | Related food listing |
| `assigned_volunteer_id` | uuid | Volunteer assigned |
| `pickup_location` | jsonb | Location object |
| `dropoff_location` | jsonb | Location object |
| `scheduled_time` | timestamptz | — |
| `estimated_duration_minutes` | integer | — |
| `points_reward` | integer | Gamification points |

---

### Table 17 — `pickup_events`
> Audit trail for every pickup lifecycle event.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | — |
| `reservation_id` | uuid | FK → reservations |
| `performed_by` | uuid | Who triggered it |
| `event_type` | text | confirmed/ready/picked_up/completed/cancelled |
| `notes` | text | — |
| `created_at` | timestamptz | — |

---

### Table 18 — `reports`
> User-flagged content for moderation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | — |
| `reporter_id` | uuid | Who reported |
| `food_listing_id` | uuid | Reported listing (optional) |
| `reported_user_id` | uuid | Reported user (optional) |
| `reason` | text | NOT NULL |
| `description` | text | Details |
| `status` | text | open / reviewing / resolved / dismissed |

---

### Table 19 — `favorites`
> User-saved food listings.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → profiles |
| `food_listing_id` | uuid | FK → food_listings |
| `created_at` | timestamptz | — |
| — | — | UNIQUE(user_id, food_listing_id) |

---

## 🔡 Enums & Custom Types

```sql
user_role:          donor | receiver | volunteer | ngo | partner | admin | rider | household
food_status:        available | reserved | partially_reserved | picked_up | completed | expired | cancelled
reservation_status: pending | confirmed | ready_for_pickup | picked_up | completed | cancelled | expired
notification_type:  reservation_created | reservation_confirmed | pickup_ready | pickup_completed |
                    donation_created | donation_completed | listing_expiring | partner_verified |
                    system | new_donation | donation_claimed | pickup_confirmed | donation_expiring |
                    verification_update | impact_milestone | rider_assigned | delivery_completed
vehicle_type:       bike | motorcycle | bicycle | scooter | car
delivery_status:    SEARCHING_RIDER | RIDER_ASSIGNED | GOING_TO_PICKUP | FOOD_PICKED_UP |
                    GOING_TO_DROPOFF | DELIVERED | COMPLETED | CANCELLED
moderation_status:  pending | approved | rejected | manual_review
```

---

## ⚡ Database Indexes

All performance-critical query paths are indexed:

```sql
-- food_listings (most queried table)
idx_food_status       → (status)
idx_food_donor        → (donor_id)
idx_food_city         → (city)
idx_food_expiry       → (available_until)
idx_food_location     → (latitude, longitude)   -- geo queries
idx_food_created      → (created_at DESC)        -- newest first

-- reservations
idx_reservation_user    → (user_id)
idx_reservation_food    → (food_listing_id)
idx_reservation_status  → (status)

-- notifications (frequently polled)
idx_notifications_user  → (user_id)
idx_notifications_unread → (user_id, is_read)   -- unread count queries

-- riders
idx_riders_user_id  → (user_id)
idx_riders_online   → (is_online) WHERE is_online = true  -- partial index

-- deliveries
idx_deliveries_rider  → (rider_id)
idx_deliveries_status → (status)

-- chat
idx_conv_part_user    → (user_id)
idx_conv_part_conv    → (conversation_id)
idx_messages_conv_created → (conversation_id, created_at ASC)
idx_messages_sender       → (sender_id)

-- rider location
idx_rider_loc_task  → (delivery_task_id, recorded_at DESC)
idx_rider_loc_rider → (rider_id, recorded_at DESC)

-- food moderation
idx_food_moderation_hash   → (image_hash) WHERE image_hash IS NOT NULL
idx_food_moderation_status → (moderation_status)

-- volunteer tasks
idx_volunteer_tasks_status    → (status)
idx_volunteer_tasks_ngo       → (ngo_id)
idx_volunteer_tasks_volunteer → (assigned_volunteer_id)
```

---

## ⚙️ Triggers & Auto-Functions

### Trigger 1 — `set_updated_at()`
Automatically updates `updated_at` on every row update:

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
```

**Applied to:** profiles, food_listings, reservations, partners, reports, riders, deliveries, volunteer_tasks, food_moderation

---

### Trigger 2 — `handle_new_user()`
Auto-creates a `profiles` row when a new user signs up (via Supabase Auth):

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'donor'::user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- Fires on: auth.users AFTER INSERT
```

---

## 🔁 PostgreSQL RPC Functions

Sharebite uses **server-side RPC functions** for atomic, race-condition-safe operations.

### RPC 1 — `reserve_food()` — Transaction-Safe Food Claiming

```sql
reserve_food(
  p_food_listing_id uuid,
  p_servings        integer,
  p_pickup_time     timestamptz DEFAULT NULL,
  p_notes           text        DEFAULT NULL
) RETURNS uuid
```

**What it does (atomic):**
1. Locks the food_listing row (`FOR UPDATE` — prevents race conditions)
2. Validates: user is logged in, servings > 0, listing exists, not own food, status available, not expired, enough servings
3. Creates a `reservation` record
4. Decrements `available_servings` on `food_listings`
5. Updates listing `status` → `reserved` (if 0 left) or `partially_reserved`
6. Inserts an `impact_event` (food_reserved)
7. Returns the new `reservation_id`

**Safety:** Uses `FOR UPDATE` row lock — two NGOs cannot claim the same servings simultaneously.

---

### RPC 2 — `get_nearby_food()` — Haversine Distance Query

```sql
get_nearby_food(
  p_latitude   double precision,
  p_longitude  double precision,
  p_radius_km  double precision DEFAULT 10
) RETURNS TABLE (id, title, category, ..., distance_km)
```

**Algorithm:** Uses the **Haversine formula** to calculate great-circle distance:
```sql
6371 * acos(
  LEAST(1, GREATEST(-1,
    cos(radians(lat1)) * cos(radians(lat2))
    * cos(radians(lng2) - radians(lng1))
    + sin(radians(lat1)) * sin(radians(lat2))
  ))
) AS distance_km
```

Returns only: `available` or `partially_reserved` listings, with servings > 0, not expired, with valid GPS coordinates. Sorted by distance ascending.

---

### RPC 3 — `nearby_ngos()` — Find NGOs Near Location

```sql
nearby_ngos(
  p_lat       double precision,
  p_lng       double precision,
  p_radius_km double precision DEFAULT 20.0
) RETURNS TABLE (id, full_name, phone, address, city, lat, lng, avatar_url, is_verified, distance_km)
```

Uses `calculate_distance_km()` helper with the **Vincenty-simplified** formula:
```sql
6371 * 2 * asin(
  sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  )
)
```

---

### RPC 4 — `get_leaderboard()` — Impact Leaderboard

```sql
get_leaderboard(
  p_role  text    DEFAULT 'donor',
  p_limit integer DEFAULT 20
) RETURNS TABLE (id, full_name, avatar_url, city, role, total_meals, total_count)
```

Efficient single-query JOIN across `profiles`, `impact_events`, `food_listings`, `reservations`. Sorted by total meals DESC.

---

### RPC 5 — `assign_rider_to_delivery()` — Race-Condition-Safe Assignment

```sql
assign_rider_to_delivery(
  p_delivery_id uuid,
  p_rider_id    uuid
) RETURNS boolean
```

**What it does (atomic):**
1. `FOR UPDATE` locks both the delivery row and the rider row
2. Checks delivery status = `SEARCHING_RIDER` (not already assigned)
3. Checks rider `is_online = true AND is_available = true`
4. Updates delivery → `RIDER_ASSIGNED` with timestamp
5. Sets rider `is_available = false`
6. Returns `true` on success, `false` if already taken

**Safety:** Prevents two users from accepting the same delivery task simultaneously.

---

## 🔐 Row-Level Security (RLS) Policies

RLS is enabled on **all tables**. JWT from Supabase Auth is used to identify the user via `auth.uid()`.

### Core RLS Patterns

```
profiles:
  SELECT  → Authenticated users can read all profiles (for chat/discovery)
  UPDATE  → Users can only update their own profile

food_listings:
  SELECT  → Anyone can read available listings
  INSERT  → Only authenticated donors can create
  UPDATE  → Only the donor who created it (donor_id = auth.uid())
  DELETE  → Only the donor who created it

reservations:
  SELECT  → The reserver AND the food donor can see it
  INSERT  → Authenticated users (via reserve_food RPC — not direct)
  UPDATE  → The donor (to confirm) or the reserver (to cancel)

notifications:
  SELECT  → Only the notification recipient (user_id = auth.uid())
  UPDATE  → Only the recipient (to mark read)

riders:
  SELECT  → Authenticated users (to see available riders)
  INSERT  → Only the user creating their own rider profile
  UPDATE  → Only the rider themselves

deliveries:
  SELECT  → Donor, NGO, or Rider involved in that delivery
  UPDATE  → Only the assigned rider, or admin

messages:
  SELECT  → Only conversation participants
  INSERT  → Only conversation participants
```

---

## 📡 Real-time Subscriptions

Supabase Realtime uses **Change Data Capture (CDC)** via PostgreSQL logical replication. The frontend subscribes to table changes using the JS SDK.

### Active Realtime Channels

| Channel | Table | Events | Used By |
|---------|-------|--------|---------|
| `food_listings_realtime` | food_listings | INSERT, UPDATE | Discover page — new listings appear live |
| `reservations_realtime` | reservations | INSERT, UPDATE | Donor dashboard — new claims appear |
| `deliveries_realtime` | deliveries | UPDATE | Rider/Donor/NGO tracking |
| `messages_realtime` | messages | INSERT | Chat — new messages appear instantly |
| `notifications_realtime` | notifications | INSERT | Notification bell updates |
| `rider_location_realtime` | rider_location_updates | INSERT | Live rider GPS tracking |

### Example Subscription (Chat)

```typescript
supabase
  .channel(`messages:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    setMessages(prev => [...prev, payload.new]);
  })
  .subscribe();
```

---

## 🔥 Edge Functions (Deno)

### `moderate-image` — AI Food Image Moderation

**Runtime:** Deno (TypeScript)
**Endpoint:** `POST /functions/v1/moderate-image`
**Trigger:** Called by frontend after food image upload

#### Request Body
```json
{
  "imageUrl": "https://storage.supabase.co/.../food.jpg",
  "foodName": "Vegetable Rice",
  "userId": "uuid",
  "foodPostId": "uuid"
}
```

#### Processing Pipeline (8 steps)

```
Step 1: Fetch image server-side (15s timeout)
Step 2: Validate file type via magic bytes (JPEG/PNG/WebP only)
Step 3: Check file size (max 5MB, configurable)
Step 4: Compute SHA-256 hash → check Supabase for duplicate
Step 5: Call HuggingFace API — 2 models in parallel:
        - nateraw/food       (food-specific classifier)
        - google/vit-base-patch16-224 (general classifier)
Step 6: Analyze results with decision engine
Step 7: Store result in food_moderation table
Step 8: Return verdict to client
```

#### AI Decision Engine

| Condition | Decision |
|-----------|----------|
| Duplicate image (same hash, different user) | ❌ rejected |
| Both AI models unavailable | ✅ auto-approved (don't block users) |
| Screenshot/meme detected (score ≥ 0.50) | ❌ rejected |
| Non-food (score ≥ 0.65, e.g. laptop, car) | ❌ rejected |
| Non-food (score 0.45–0.65) | ❌ rejected |
| Food detected (score ≥ 0.25) | ✅ approved |
| Ambiguous | ✅ approved with note |

#### HuggingFace Models

| Model | Purpose | Free Tier |
|-------|---------|-----------|
| `nateraw/food` | Food-specific — 101 food classes | 1,000 req/day |
| `google/vit-base-patch16-224` | General image classification | 1,000 req/day |

#### Security Features
- **API key never reaches client** — HF_TOKEN stored as Supabase secret
- **Magic byte validation** — rejects non-image files even with `.jpg` extension
- **SHA-256 duplicate check** — prevents reuse of downloaded images
- **Rate limit handling** — 429 → auto-approve, 503 → retry with backoff
- **Timeout protection** — 20s per model call, 15s image fetch
- **Safe fallback** — never crashes, always returns a verdict

#### Environment Variables (Supabase Secrets)
```bash
HF_TOKEN                    # HuggingFace API key
SUPABASE_URL                # Project URL
SUPABASE_SERVICE_ROLE_KEY   # Service role (bypasses RLS for moderation writes)
MAX_IMAGE_SIZE_MB           # Default: 5
```

---

## 🗂️ Supabase Storage

| Bucket | Contents | Access |
|--------|---------|--------|
| `food-images` | Food listing photos | Public read, Auth write |
| `avatars` | Profile photos | Public read, Auth write (own only) |
| `documents` | ID verification docs | Private (admin only) |

**Upload flow:**
1. Frontend uploads to Supabase Storage → gets public URL
2. URL is passed to `moderate-image` Edge Function
3. If approved → URL saved to `food_listings.image_url`
4. If rejected → user shown rejection reason, image removed

---

## 🔑 Authentication System

| Feature | Implementation |
|---------|---------------|
| **Email + Password** | Supabase GoTrue built-in |
| **Google OAuth** | Supabase OAuth provider |
| **GitHub OAuth** | Supabase OAuth provider |
| **JWT Tokens** | Auto-issued on login, refreshed automatically |
| **Session Persistence** | LocalStorage via supabase-js |
| **Password Reset** | Email magic link via GoTrue |
| **Role in JWT** | `raw_user_meta_data.role` stored at signup |
| **Profile Auto-creation** | `handle_new_user()` trigger fires on `auth.users` INSERT |

---

## 🔧 Service Layer (TypeScript)

All backend interactions are wrapped in typed service classes:

### `DonationService` (`donations.ts`)
| Method | Operation |
|--------|-----------|
| `createListing(form)` | INSERT into food_listings |
| `getMyListings(userId)` | SELECT with donor_id filter |
| `getNearbyListings(lat, lng, radius)` | Calls `get_nearby_food()` RPC |
| `updateListing(id, updates)` | UPDATE with ownership check |
| `cancelListing(id)` | UPDATE status = 'cancelled' |
| `getListingById(id)` | SELECT with join to profiles |

### `ClaimsService` (`claims.ts`)
| Method | Operation |
|--------|-----------|
| `claimFood(listingId, servings)` | Calls `reserve_food()` RPC |
| `getNgoClaims(ngoId)` | SELECT reservations with joins |
| `confirmPickup(taskId, code, servings)` | UPDATE delivery + verify pickup code |
| `confirmNgoReceipt(taskId, qty, notes)` | UPDATE delivery + distribution record |
| `cancelClaim(claimId, reason)` | UPDATE reservation status |
| `getDonorDashboardListings(donorId)` | Complex JOIN query for donor view |
| `getRiderTasks(riderId)` | SELECT delivery_tasks assigned to rider |

**Dual-mode architecture:** Primary calls PostgreSQL RPCs; falls back to direct table queries if RPC unavailable — ensures 100% uptime.

### `ChatService` (`chat.ts`)
| Method | Operation |
|--------|-----------|
| `getOrCreateDirectConversation(userId, recipientId)` | Find existing or INSERT new conversation |
| `getConversations(userId)` | SELECT all user's conversations with last message |
| `getMessages(conversationId)` | SELECT messages ordered by created_at |
| `sendMessage(conversationId, content, type)` | INSERT into messages |
| `markAsRead(conversationId, userId)` | UPDATE last_read_at |

### `ImpactService` (`impact.ts`)
| Method | Operation |
|--------|-----------|
| `getCommunityImpact()` | Aggregate query across impact_events |
| `getUserImpact(userId, role)` | Per-user impact stats |

### `LocationService` (`location.ts`)
| Method | Operation |
|--------|-----------|
| `getCurrentPosition()` | Browser Geolocation API |
| `reverseGeocode(lat, lng)` | Nominatim (OpenStreetMap) reverse geocoding |
| `getNearbyNGOs(lat, lng, radius)` | Calls `nearby_ngos()` RPC |

---

## 📜 Migration History

| File | Version | Contents |
|------|---------|---------|
| `migration.sql` | v1 | Base schema: profiles, food_listings, reservations, favorites, partners, pickup_events, notifications, impact_events, reports |
| `rider_delivery_migration.sql` | v2 | riders, deliveries, rider_ratings, volunteer_tasks tables + delivery RPCs |
| `moderation_migration.sql` | v3 | food_moderation table + AI moderation columns |
| `chat_and_realtime_migration.sql` | v4 | conversations, conversation_participants, messages, rider_location_updates + nearby_ngos RPC |
| `ngo_discovery_migration.sql` | v5 | India NGO directory tables + search/filter RPCs |
| `phase2_14_migration.sql` | v6 | Extended claims system, delivery task workflow, pickup/dropoff codes |
| `god_mode_migration.sql` | v7 | Admin god-mode: bulk operations, platform stats, manual override |
| `profiles_rls_fix.sql` | patch | RLS policy fixes — corrects permission gaps |
| `web_fixes_migration.sql` | patch | Web-specific patches (enum additions, column fixes) |
| `complete_schema.sql` | **v3 canonical** | ✅ **Idempotent merge of all above** — run this to set up fresh DB |

---

## 🛡️ Backend Security Summary

| Layer | Mechanism |
|-------|----------|
| **Transport** | HTTPS enforced by Supabase CDN |
| **Authentication** | JWT tokens (HS256) issued by GoTrue |
| **Authorization** | PostgreSQL RLS on every table |
| **API Keys** | Stored in `.env`, never committed |
| **Edge Function Secrets** | Supabase Vault (never in source code) |
| **Race Conditions** | `FOR UPDATE` locks in reservation & assignment RPCs |
| **Image Safety** | SHA-256 deduplication + AI moderation |
| **File Validation** | Magic byte checking (JPEG/PNG/WebP only) |
| **UUID Validation** | `isValidUUID()` utility prevents injection |
| **Self-Claim Prevention** | `reserve_food()` RPC rejects `donor_id = auth.uid()` |
| **Data Integrity** | CHECK constraints on all enum columns |
| **Cascade Deletes** | FK cascades maintain referential integrity |

---

## 🌍 Environment Variables

```env
# Supabase (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Edge Function Secrets (set via: supabase secrets set KEY=value)
HF_TOKEN=hf_...                    # HuggingFace API key (free tier)
SUPABASE_URL=...                   # Auto-injected by Supabase
SUPABASE_SERVICE_ROLE_KEY=...      # Auto-injected by Supabase
MAX_IMAGE_SIZE_MB=5                # Optional, default 5
```

---

*Backend Report — Sharebite v1.0 | November 2026*
*Schema: PostgreSQL 15 | Supabase Platform | Deno Edge Functions*
