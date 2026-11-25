# 📡 Sharebite — Complete API & Stored Procedure Reference

> Developer reference and contract specifications for all PostgreSQL Stored Procedures (RPCs), PostgREST RESTful endpoints, Deno Edge Functions, and Supabase Realtime WebSocket events.

---

## 📋 Table of Contents

1. [API Architecture & Protocols](#-1-api-architecture--protocols)
2. [Authentication & Authorization Headers](#-2-authentication--authorization-headers)
3. [PostgreSQL Stored Procedures (RPCs)](#-3-postgresql-stored-procedures-rpcs)
   - [`reserve_food`](#31-reserve_food)
   - [`get_nearby_food`](#32-get_nearby_food)
   - [`nearby_ngos`](#33-nearby_ngos)
   - [`assign_rider_to_delivery`](#34-assign_rider_to_delivery)
   - [`get_leaderboard`](#35-get_leaderboard)
   - [`calculate_distance_km`](#36-calculate_distance_km)
4. [Serverless Edge Functions (Deno)](#-4-serverless-edge-functions-deno)
   - [`POST /moderate-image`](#41-post-moderate-image)
5. [Core RESTful Endpoints (PostgREST)](#-5-core-restful-endpoints-postgrest)
   - [Food Listings API](#51-food-listings-api)
   - [Reservations & Claims API](#52-reservations--claims-api)
   - [Deliveries & Dispatch API](#53-deliveries--dispatch-api)
   - [Real-Time Messaging API](#54-real-time-messaging-api)
   - [Telemetry & Location API](#55-telemetry--location-api)
   - [Notifications API](#56-notifications-api)
6. [Realtime WebSocket Channels (CDC Subscriptions)](#-6-realtime-websocket-channels-cdc-subscriptions)
7. [Standard Error Codes & Handling](#-7-standard-error-codes--handling)

---

## 🌐 1. API Architecture & Protocols

Sharebite provides access via three complementary protocols:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SHAREBITE API SURFACE                           │
├─────────────────────┬────────────────────┬─────────────────────────────┤
│  PostgREST REST API │  DENO EDGE RUNTIME │  REALTIME WEBSOCKETS (CDC)  │
│ HTTPS /rest/v1      │ HTTPS /functions/v1│ WSS /realtime/v1            │
│ CRUD & Atomic RPCs  │ AI Food Moderation │ Chat & Rider Live Telemetry │
└─────────────────────┴────────────────────┴─────────────────────────────┘
```

- **Base URL**: `https://<PROJECT_REF>.supabase.co`
- **Content Type**: `application/json`
- **Rate Limiting**: 500 requests/minute per IP address (enforced by Edge Gateway)

---

## 🔐 2. Authentication & Authorization Headers

All API requests must pass authentication via HTTP headers:

```http
apikey: <SUPABASE_ANON_PUBLIC_KEY>
Authorization: Bearer <USER_JWT_TOKEN>
Content-Type: application/json
Prefer: return=representation
```

| Header | Required | Description |
|:---|:---:|:---|
| `apikey` | **Yes** | Client identification token; required for gateway routing. |
| `Authorization` | Conditional | `Bearer <JWT>` issued by Supabase GoTrue. Unauthenticated requests assume the `anon` PostgreSQL role. |
| `Prefer` | Optional | PostgREST directive (e.g. `return=representation` returns inserted/updated rows). |

---

## 🔁 3. PostgreSQL Stored Procedures (RPCs)

Stored procedures execute server-side within the database transaction kernel, guaranteeing ACID consistency.

### 3.1 `reserve_food`
> **Atomically claims servings from a food listing with row-level mutex locking.**

- **Endpoint**: `POST /rest/v1/rpc/reserve_food`
- **Access Level**: Authenticated User (`donor != auth.uid()`)

#### Request Parameters
```json
{
  "p_food_listing_id": "a1b2c3d4-e5f6-4001-8001-000000000001",
  "p_servings": 25,
  "p_pickup_time": "2026-11-16T22:30:00Z",
  "p_notes": "Volunteer team arriving in temperature-insulated vehicle"
}
```

| Parameter | Type | Required | Description |
|:---|:---:|:---:|:---|
| `p_food_listing_id` | `uuid` | **Yes** | ID of the target food listing. |
| `p_servings` | `integer` | **Yes** | Quantity of servings to claim (`> 0`). |
| `p_pickup_time` | `timestamptz` | No | Estimated arrival timestamp. |
| `p_notes` | `text` | No | Special instructions or vehicle specifics. |

#### Successful Response (`200 OK`)
Returns the generated reservation `UUID`:
```json
"9ecc652c-b90c-4e48-a56a-4c0d5db196be"
```

#### Error Exceptions (`400 Bad Request`)
- `"You must be logged in"`
- `"Servings must be greater than zero"`
- `"Food listing not found"`
- `"You cannot reserve your own food"`
- `"This food is no longer available"`
- `"This food listing has expired"`
- `"Not enough servings available. Requested: 25, Available: 10"`

---

### 3.2 `get_nearby_food`
> **Computes spatial Haversine proximity for all active, unexpired food listings.**

- **Endpoint**: `POST /rest/v1/rpc/get_nearby_food`
- **Access Level**: Public / Authenticated

#### Request Parameters
```json
{
  "p_latitude": 28.6139,
  "p_longitude": 77.2090,
  "p_radius_km": 15.0
}
```

#### Successful Response (`200 OK`)
```json
[
  {
    "id": "a1b2c3d4-e5f6-4001-8001-000000000001",
    "title": "Vegetable Biryani & Dal",
    "description": "Hot catering trays from reception banquet",
    "category": "biryani",
    "food_type": "veg",
    "servings": 40,
    "available_servings": 25,
    "image_url": "https://xyz.supabase.co/storage/v1/object/public/food-images/biryani.jpg",
    "pickup_address": "Connaught Place, Central Delhi",
    "city": "Delhi",
    "latitude": 28.6315,
    "longitude": 77.2167,
    "available_until": "2026-11-16T23:45:00Z",
    "status": "partially_reserved",
    "is_urgent": false,
    "distance_km": 2.14
  }
]
```

---

### 3.3 `nearby_ngos`
> **Searches registered NGOs within a radial distance from a given coordinate.**

- **Endpoint**: `POST /rest/v1/rpc/nearby_ngos`
- **Access Level**: Public / Authenticated

#### Request Parameters
```json
{
  "p_lat": 23.2599,
  "p_lng": 77.4126,
  "p_radius_km": 20.0
}
```

#### Successful Response (`200 OK`)
```json
[
  {
    "id": "d3819150-4d31-4e95-8972-15b722d5f3e3",
    "full_name": "Robin Hood Army Bhopal",
    "phone": "+91 98101 23456",
    "address": "Arera Colony, E-3 Sector",
    "city": "Bhopal",
    "latitude": 23.2145,
    "longitude": 77.4285,
    "avatar_url": "https://xyz.supabase.co/storage/v1/object/public/avatars/rha.png",
    "is_verified": true,
    "distance_km": 5.28
  }
]
```

---

### 3.4 `assign_rider_to_delivery`
> **Atomically dispatches a delivery job to a verified rider, locking both rows against race conditions.**

- **Endpoint**: `POST /rest/v1/rpc/assign_rider_to_delivery`
- **Access Level**: Authenticated Rider

#### Request Parameters
```json
{
  "p_delivery_id": "784b0512-1de9-443c-ac11-eb7132d1079e",
  "p_rider_id": "4be44dd0-ffb1-4f9d-ae4e-3ec8689c3de0"
}
```

#### Successful Response (`200 OK`)
```json
true
```
*(Returns `false` if the job has already been accepted by another rider or if the rider is currently offline/unavailable).*

---

### 3.5 `get_leaderboard`
> **Aggregates community rescue milestones, rank-ordered by total meals saved.**

- **Endpoint**: `POST /rest/v1/rpc/get_leaderboard`
- **Access Level**: Public / Authenticated

#### Request Parameters
```json
{
  "p_role": "donor",
  "p_limit": 10
}
```

#### Successful Response (`200 OK`)
```json
[
  {
    "id": "51059a05-23eb-4d61-b856-20a42e790403",
    "full_name": "Taj Mahal Palace Hotel",
    "avatar_url": "https://xyz.supabase.co/storage/v1/object/public/avatars/taj.jpg",
    "city": "Mumbai",
    "role": "donor",
    "total_meals": 4850,
    "total_count": 86
  }
]
```

---

### 3.6 `calculate_distance_km`
> **Pure immutable mathematical helper for coordinate distance.**

- **Endpoint**: `POST /rest/v1/rpc/calculate_distance_km`
- **Access Level**: Public

#### Request Parameters
```json
{
  "lat1": 28.6139,
  "lon1": 77.2090,
  "lat2": 19.0760,
  "lon2": 72.8777
}
```
#### Response (`200 OK`): `1148.52`

---

## ⚡ 4. Serverless Edge Functions (Deno)

Deployed globally on Supabase Edge Network. Secrets reside in the vault and are never exposed to the client.

### 4.1 `POST /moderate-image`
> **Screens food listing photos for authenticity, food presence, spam, screenshots, and duplicate binary hashes.**

- **Endpoint**: `POST /functions/v1/moderate-image`
- **Runtime**: Deno 1.30+
- **Access Level**: Authenticated User

#### Request Headers
```http
Authorization: Bearer <USER_JWT>
Content-Type: application/json
```

#### Request Payload
```json
{
  "imageUrl": "https://xyz.supabase.co/storage/v1/object/public/food-images/plate.jpg",
  "foodName": "Dal Tadka & Roti",
  "userId": "51059a05-23eb-4d61-b856-20a42e790403",
  "foodPostId": "a1b2c3d4-e5f6-4001-8001-000000000001"
}
```

#### Approved Response (`200 OK`)
```json
{
  "decision": "approved",
  "reason": "Food verified! Detected 'dal' with 94% confidence.",
  "is_food": true,
  "is_spam": false,
  "is_screenshot": false,
  "is_advertisement": false,
  "is_duplicate": false,
  "quality_score": 0.942,
  "confidence": 0.985
}
```

#### Rejected Response (`200 OK`)
```json
{
  "decision": "rejected",
  "reason": "This image appears to show 'laptop' instead of food. Please upload a real photo of the meal you are sharing.",
  "is_food": false,
  "is_spam": true,
  "is_screenshot": false,
  "is_advertisement": false,
  "is_duplicate": false,
  "quality_score": 0.0,
  "confidence": 0.88
}
```

---

## 📦 5. Core RESTful Endpoints (PostgREST)

### 5.1 Food Listings API

#### Query Active Listings
```http
GET /rest/v1/food_listings?status=eq.available&available_until=gt.now()&order=created_at.desc&limit=20
```

#### Create a New Listing
```http
POST /rest/v1/food_listings
Content-Type: application/json
Prefer: return=representation

{
  "donor_id": "51059a05-23eb-4d61-b856-20a42e790403",
  "title": "Fresh Paneer Sabzi & Phulkas",
  "description": "Hygenic packaged boxes from corporate lunch buffet",
  "category": "sabzi",
  "food_type": "veg",
  "packaging_type": "box",
  "servings": 35,
  "available_servings": 35,
  "pickup_address": "Cyber City, Phase 2",
  "city": "Gurugram",
  "latitude": 28.4950,
  "longitude": 77.0895,
  "available_from": "2026-11-16T15:00:00Z",
  "available_until": "2026-11-16T19:00:00Z",
  "is_urgent": false,
  "moderation_status": "approved"
}
```

---

### 5.2 Reservations & Claims API

#### Get Claims for an NGO
```http
GET /rest/v1/reservations?user_id=eq.d3819150-4d31-4e95-8972-15b722d5f3e3&select=*,food_listings(*)&order=created_at.desc
```

#### Update Claim Status
```http
PATCH /rest/v1/reservations?id=eq.784b0512-1de9-443c-ac11-eb7132d1079e
Content-Type: application/json

{
  "status": "ready_for_pickup"
}
```

---

### 5.3 Deliveries & Dispatch API

#### Query Open Dispatch Tasks
```http
GET /rest/v1/deliveries?status=eq.SEARCHING_RIDER&is_self_pickup=eq.false&order=created_at.desc
```

#### Confirm Delivery Step (Rider)
```http
PATCH /rest/v1/deliveries?id=eq.784b0512-1de9-443c-ac11-eb7132d1079e
Content-Type: application/json

{
  "status": "DELIVERED",
  "delivered_at": "2026-11-16T18:45:10Z"
}
```

---

### 5.4 Real-Time Messaging API

#### Fetch Messages for a Conversation
```http
GET /rest/v1/messages?conversation_id=eq.784b0512-1de9-443c-ac11-eb7132d1079e&order=created_at.asc&limit=100
```

#### Send a Message
```http
POST /rest/v1/messages
Content-Type: application/json

{
  "conversation_id": "784b0512-1de9-443c-ac11-eb7132d1079e",
  "sender_id": "51059a05-23eb-4d61-b856-20a42e790403",
  "content": "Rider has arrived at our kitchen gates. Handing over 3 trays.",
  "message_type": "text"
}
```

---

### 5.5 Telemetry & Location API

#### Ingest Live Rider Coordinates
```http
POST /rest/v1/rider_location_updates
Content-Type: application/json

{
  "rider_id": "4be44dd0-ffb1-4f9d-ae4e-3ec8689c3de0",
  "delivery_task_id": "784b0512-1de9-443c-ac11-eb7132d1079e",
  "latitude": 28.6210,
  "longitude": 77.2140,
  "heading": 45.2,
  "speed": 8.5
}
```

---

### 5.6 Notifications API

#### Mark All User Notifications as Read
```http
PATCH /rest/v1/notifications?user_id=eq.51059a05-23eb-4d61-b856-20a42e790403&is_read=eq.false
Content-Type: application/json

{
  "is_read": true
}
```

---

## 📡 6. Realtime WebSocket Channels (CDC Subscriptions)

WebSockets operate on standard Supabase Realtime Phoenix channels (`wss://<PROJECT_REF>.supabase.co/realtime/v1/websocket`).

### 6.1 Subscribing to Chat Room Updates
```typescript
import { supabase } from '../lib/supabase';

const channel = supabase
  .channel(`messages:${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      console.log('New message received:', payload.new);
    }
  )
  .subscribe();
```

### 6.2 Subscribing to Live Rider GPS Radar
```typescript
const radarChannel = supabase
  .channel(`delivery:${deliveryId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'rider_location_updates',
      filter: `delivery_task_id=eq.${deliveryId}`,
    },
    (payload) => {
      const { latitude, longitude, heading } = payload.new;
      map.updateRiderMarker(latitude, longitude, heading);
    }
  )
  .subscribe();
```

---

## 🚨 7. Standard Error Codes & Handling

Sharebite formats errors into a standard RESTful payload:

```json
{
  "code": "PGRST116",
  "message": "JSON object requested, multiple (or no) rows returned",
  "details": "The result contains 0 rows",
  "hint": null
}
```

| HTTP Status | PostgREST / DB Code | Scenario | Recommended Client Action |
|:---:|:---:|:---|:---|
| **`400`** | `P0001` | Stored procedure check violated (`reserve_food` insufficient servings). | Parse `message` string and display alert banner to user. |
| **`401`** | `PGRST301` | Missing or expired JWT token. | Clear local token and invoke `AuthContext.login()`. |
| **`403`** | `42501` | Row-Level Security (RLS) policy check failed. | Unauthorized attempt to edit another tenant's entity. |
| **`404`** | `PGRST116` | Record does not exist or user lacks read privileges under RLS. | Render `<EmptyState />` or redirect to `/dashboard`. |
| **`409`** | `23505` | Unique constraint collision (e.g. user already joined conversation). | Retrieve existing record instead of creating new. |
| **`429`** | `EDGE_RATE_LIMIT`| HuggingFace AI moderation quota reached. | Automatic circuit-breaker triggers graceful pass-through. |

---

*Sharebite API & RPC Specifications — Version 1.0 | November 2026*
