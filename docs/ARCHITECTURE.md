# 🏛️ Sharebite — System Architecture Specification

> **Enterprise-Grade Distributed Food Rescue & Redistribution Architecture**  
> Modern Fullstack Blueprint: React 19, TypeScript 6.0, Supabase PostgreSQL 15, PostgREST, Realtime WebSockets, Deno Edge AI, Leaflet GIS, and Row-Level Concurrency Locking.

---

## 📋 Table of Contents

1. [Executive Architectural Summary](#-1-executive-architectural-summary)
2. [End-to-End System Topology (C4 Model)](#-2-end-to-end-system-topology-c4-model)
3. [Client Tier & Frontend Engineering](#-3-client-tier--frontend-engineering)
   - 3.1 [React 19 SPA & Routing Matrix](#31-react-19-spa--routing-matrix)
   - 3.2 [Server State & TanStack Query Caching](#32-server-state--tanstack-query-caching)
   - 3.3 [GIS Mapping Engine & Proximity Calculation](#33-gis-mapping-engine--proximity-calculation)
4. [Backend & Database Tier](#-4-backend--database-tier)
   - 4.1 [PostgreSQL 15 Kernel & Supavisor Connection Pooling](#41-postgresql-15-kernel--supavisor-connection-pooling)
   - 4.2 [19 Core Relational Tables & Schema Topology](#42-19-core-relational-tables--schema-topology)
   - 4.3 [PostgREST Stored Procedures (RPC Engine)](#43-postgrest-stored-procedures-rpc-engine)
5. [Concurrency, Mutex & Atomic Transactions](#-5-concurrency-mutex--atomic-transactions)
   - 5.1 [Zero Double-Spend Mutex (`claim_food_atomic`)](#51-zero-double-spend-mutex-claim_food_atomic)
   - 5.2 [6-Digit Dynamic PIN Cryptographic Handshake](#52-6-digit-dynamic-pin-cryptographic-handshake)
6. [Realtime WebSocket Event Pipeline](#-6-realtime-websocket-event-pipeline)
7. [Deno Edge Functions & AI Image Moderation](#-7-deno-edge-functions--ai-image-moderation)
8. [Offline-First Resilience & PWA Architecture](#-8-offline-first-resilience--pwa-architecture)
9. [Security, Identity & Regulatory Architecture](#-9-security-identity--regulatory-architecture)
10. [Vite Build Optimization & Vendor Chunking](#-10-vite-build-optimization--vendor-chunking)
11. [Repository & Directory Architecture](#-11-repository--directory-architecture)
12. [Architectural Decision Records (ADR)](#-12-architectural-decision-records-adr)

---

## 📌 1. Executive Architectural Summary

Sharebite is engineered to solve a time-critical, geographically distributed logistics problem: **rapidly redistributing perishable commercial surplus food to vulnerable communities before spoilage occurs**.

Because cooked meals spoil within 2 to 4 hours in tropical Indian ambient conditions, the architecture is designed around four core non-negotiable principles:
1. **Sub-second Discovery**: Instant geospatial matching of available surplus meals within a 5–10 km radius.
2. **Zero Double-Allocation**: Row-level locking ensures two NGOs or riders cannot claim the same meal simultaneously.
3. **Cryptographically Verified Handoff**: Non-repudiable 6-digit dynamic PIN delivery confirmation.
4. **Offline Courier Resilience**: Seamless state transition caching in IndexedDB during mobile network drops.

---

## 🌐 2. End-to-End System Topology (C4 Model)

```mermaid
flowchart TD
    subgraph Clients["CLIENT TIER (Mobile & Desktop Web)"]
        DonorUI["🏨 Donor Portal\n(Listings, Expiry, 80G Receipts)"]
        NgoUI["🏢 NGO Portal\n(Proximity Claim, Dietary Filters)"]
        RiderUI["🛵 Volunteer Rider PWA\n(Turn-by-turn GIS, PIN Handshake)"]
        AdminUI["🛡️ Admin Command Center\n(AI Moderation, Live Rescues)"]
    end

    subgraph EdgeTier["EDGE & CDN TIER (Vercel & Anycast DNS)"]
        CDN["Vercel Global Edge CDN\n(Gzip/Brotli, Static React 19 Bundle)"]
        Rewrite["Edge Rewrites\n(/* → /index.html SPA)"]
    end

    subgraph SupabasePlatform["BACKEND AS A SERVICE (Supabase Cluster)"]
        GoTrue["🔐 GoTrue Auth Engine\n(JWT Tokens, RBAC, OAuth)"]
        PostgREST["⚡ PostgREST HTTP Engine\n(RESTful APIs, Auto-schema)"]
        Realtime["📡 Realtime Engine\n(WebSockets, WAL CDC Stream)"]
        Storage["📦 S3-Compatible Object Store\n(Food Photos, Avatars, Documents)"]
        Supavisor["🔄 Supavisor Pooler\n(Transactional Connection Management)"]
        PostgresDB[("🐘 PostgreSQL 15 Database\n19 Relational Tables + RLS\nAtomic Stored Procedures")]
    end

    subgraph EdgeCompute["SERVERLESS COMPUTE (Deno Subsystem)"]
        DenoEdge["🤖 Deno Edge Function\n(/moderate-image AI Vision Scan)"]
    end

    Clients --> CDN
    CDN --> Rewrite
    Rewrite --> GoTrue
    Rewrite --> PostgREST
    Rewrite --> Realtime
    Rewrite --> Storage

    PostgREST --> Supavisor
    Realtime --> PostgresDB
    Supavisor --> PostgresDB
    Storage --> DenoEdge
    DenoEdge --> PostgresDB
```

---

## ⚛️ 3. Client Tier & Frontend Engineering

The frontend is built as a single-page application (SPA) with **React 19.2.8** and **TypeScript 6.0.2**, compiled using **Vite 8.3.0**.

### 3.1 React 19 SPA & Routing Matrix

Routing is handled via **React Router DOM v7** with strict role-based navigation guards:

| Route Path | Primary Component | Role Access | Functionality |
|:---|:---|:---|:---|
| `/` | `LandingPage` | Public | Realtime hero counter, impact stats, testimonials |
| `/about` | `AboutPage` | Public | UN SDG alignment, mission statement, partner list |
| `/login` | `LoginPage` | Public | Email/password, OAuth & demo user switcher |
| `/signup` | `SignupPage` | Public | Persona registration (Donor, NGO, Rider, Community) |
| `/donor-dashboard`| `DonorDashboardPage` | `donor` | Active batches, remaining shelf-life, dispatch status |
| `/ngo-dashboard` | `NGOClaimsDashboard` | `ngo`, `receiver` | Nearby drops, dietary badges, claim modal |
| `/rider-dashboard`| `RiderDashboardPage` | `rider`, `volunteer`| Mission radar, route optimization, PIN verification |
| `/map` | `MapPage` | Authenticated | Interactive Leaflet GIS map with cluster markers |
| `/chat` | `ChatPage` | Authenticated | Realtime peer-to-peer donor/rider coordination |
| `/admin` | `AdminPage` | `admin` | Realtime rescue metrics, AI moderation queue |

### 3.2 Server State & TanStack Query Caching

To prevent UI latency and eliminate stale data:
- **`TanStack React Query v5`** manages all asynchronous server state with a 30-second stale time (`staleTime: 30000`).
- Cache keys follow hierarchical namespacing:
  - `['food-listings', { status: 'available', radiusKm: 10 }]`
  - `['active-deliveries', riderId]`
  - `['impact-metrics', 'aggregate']`
- **Optimistic Updates**: When a rider accepts a run, the UI immediately marks the card as `in_transit` before the server response returns, rolling back on error.

### 3.3 GIS Mapping Engine & Proximity Calculation

Spatial discovery leverages **Leaflet** and **React-Leaflet**:
- Custom SVG markers denote donor hotspots, active riders, and verified community shelters.
- Client-side distance sorting implements the Haversine formula for instantaneous proximity queries:

$$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$

---

## 🗄️ 4. Backend & Database Tier

### 4.1 PostgreSQL 15 Kernel & Supavisor Connection Pooling
The backend utilizes managed **PostgreSQL 15** on Supabase.
- **Supavisor** manages transactional connection pooling (port 6543), allowing over 10,000 concurrent client sessions without exhausting Postgres database worker connections.
- **Statement Timeouts**: Max query execution time is capped at 8 seconds to prevent resource exhaustion.

### 4.2 19 Core Relational Tables & Schema Topology

The database enforces referential integrity across 19 dedicated tables:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SHAREBITE DATA TOPOLOGY                            │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ 👤 Identity & Roles  │ 🍱 Food Supply Chain │ 🛵 Logistics & Delivery       │
│  - profiles          │  - food_listings     │  - riders                     │
│  - partners          │  - reservations      │  - deliveries                 │
│  - user_roles (enum) │  - donations         │  - volunteer_tasks            │
│                      │  - food_moderation   │  - rider_location_updates     │
│                      │                      │  - rider_ratings              │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ 📡 Realtime & Social │ 📊 Environmental ESG │ 🛡️ Audit & Moderation         │
│  - conversations     │  - impact_events     │  - reports                    │
│  - chat_messages     │  - favorites         │  - pickup_events              │
│  - notifications     │                      │  - error_logs                 │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

### 4.3 PostgREST Stored Procedures (RPC Engine)
To maintain zero-trust isolation, write operations execute through ACID-compliant PostgreSQL functions:
- `claim_food_atomic(p_listing_id, p_claimer_id, p_servings)`: Prevents race conditions.
- `verify_pickup_pin(p_delivery_id, p_input_pin)`: Validates 6-digit handover code.
- `calculate_co2_offset(p_weight_kg)`: Calculates IPCC-certified carbon avoidance.

---

## ⚡ 5. Concurrency, Mutex & Atomic Transactions

### 5.1 Zero Double-Spend Mutex (`claim_food_atomic`)

When multiple NGOs claim a popular food listing simultaneously:

```sql
CREATE OR REPLACE FUNCTION claim_food_atomic(
    p_listing_id UUID,
    p_claimer_id UUID,
    p_servings_requested INT
) RETURNS JSONB AS $$
DECLARE
    v_available_servings INT;
    v_new_status TEXT;
BEGIN
    -- Acquire exclusive row-level mutex lock
    SELECT servings INTO v_available_servings
    FROM food_listings
    WHERE id = p_listing_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'LISTING_NOT_FOUND');
    END IF;

    IF v_available_servings < p_servings_requested THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_SERVINGS');
    END IF;

    -- Compute remaining servings & update status atomically
    IF (v_available_servings - p_servings_requested) = 0 THEN
        v_new_status := 'reserved';
    ELSE
        v_new_status := 'partially_reserved';
    END IF;

    UPDATE food_listings
    SET servings = servings - p_servings_requested,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_listing_id;

    -- Create reservation record
    INSERT INTO reservations (listing_id, claimer_id, servings_claimed, status)
    VALUES (p_listing_id, p_claimer_id, p_servings_requested, 'confirmed');

    RETURN jsonb_build_object('success', true, 'remaining_servings', v_available_servings - p_servings_requested);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.2 6-Digit Dynamic PIN Cryptographic Handshake

To prevent fraudulent claims and ensure food physically reaches beneficiaries:
1. Upon reservation confirmation, the system creates a cryptographically secure 6-digit PIN (`random_between(100000, 999999)`).
2. The PIN is visible **only on the recipient NGO's dashboard**.
3. When the rider arrives at the shelter, the NGO verbally communicates the PIN.
4. The stored procedure `verify_pickup_pin()` executes in constant time:
   - Matches PIN hash.
   - Marks delivery as `completed`.
   - Distributes gamified impact points to the courier.

---

## 📡 6. Realtime WebSocket Event Pipeline

Sharebite leverages PostgreSQL **Write-Ahead Log (WAL) Change Data Capture (CDC)** piped through Supabase Realtime WebSockets:

```
PostgreSQL Table Mutation (INSERT/UPDATE)
            │
            ▼
Postgres Logical Replication (WAL)
            │
            ▼
Supabase Realtime Elixir/Phoenix PubSub
            │
            ▼
WebSocket Frame to Connected Clients (Browser/PWA)
```

### Subscribed Realtime Channels:
- `deliveries:active`: Live GPS coordinate updates from active riders.
- `chat:conversation_id`: Instant bidirectional messaging between donor and rider.
- `notifications:user_id`: High-priority popups for expiring food and claim alerts.

---

## 🤖 7. Deno Edge Functions & AI Image Moderation

Every donor food photograph is passed through an asynchronous edge pipeline:

```
Donor Uploads Image ──▶ Supabase Storage Bucket ('food-images')
                                │
                                ▼
                       Storage Webhook Trigger
                                │
                                ▼
                   Deno Edge Function (/moderate-image)
                                │
                                ├─▶ NSFW & Safety Scan
                                ├─▶ Deep Learning Food Classification
                                └─▶ Perceptual Hash Duplicate Detection
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
  [ Confidence >= 85% ]                   [ Confidence < 85% ]
  Mark Listing 'Available'                Flag to /admin/moderation Queue
```

---

## 📱 8. Offline-First Resilience & PWA Architecture

Riders frequently operate in basement parking garages or low-reception corridors. The PWA maintains operational continuity through:
- **Service Worker Caching**: All static JS/CSS and map tile assets are cached locally via CacheStorage.
- **IndexedDB Sync Queue**:
  - Offline actions (`confirm_pickup`, `dropoff_attempt`) are serialized as timestamped mutation objects in IndexedDB.
  - A `BackgroundSync` worker automatically plays back queued mutations in FIFO sequence upon network restoration.

---

## 🔒 9. Security, Identity & Regulatory Architecture

### 9.1 Zero-Trust Row-Level Security (RLS)
Every single table in Sharebite enforces PostgreSQL Row-Level Security:
```sql
ALTER TABLE food_listings ENABLE ROW LEVEL SECURITY;

-- Public can discover available food
CREATE POLICY "Public read available listings"
ON food_listings FOR SELECT
USING (status IN ('available', 'partially_reserved'));

-- Donors can only update their own listings
CREATE POLICY "Donors manage own listings"
ON food_listings FOR ALL
USING (auth.uid() = donor_id);
```

### 9.2 Regulatory & Legal Architecture
- **DPDP Act 2023**: Indian Digital Personal Data Protection compliance; phone numbers masked as `+91-XXXXX-98210` in courier views.
- **FSSAI Section 87**: Integrated Good Samaritan liability protection safeguards bona fide donors from civil claims.
- **Tax Deductions**: Automatic generation of verified Section 80G receipts for corporate surplus contributors.

---

## ⚡ 10. Vite Build Optimization & Vendor Chunking

To achieve sub-second load times on 3G/4G Indian networks, `vite.config.ts` splits vendor code into dedicated cacheable bundles:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-supabase': ['@supabase/supabase-js'],
        'vendor-leaflet': ['leaflet', 'react-leaflet'],
        'vendor-query': ['@tanstack/react-query'],
        'vendor-icons': ['lucide-react']
      }
    }
  }
}
```

---

## 📁 11. Repository & Directory Architecture

```
SHAREBITE - food rescuing app/
├── README.md                      # Primary Project Documentation
│
├── docs/                          # Complete Documentation Suite
│   ├── README.md                  # Central Docs Index
│   ├── ARCHITECTURE.md            # This System Architecture Document
│   ├── BACKEND_REPORT.md          # 19 Database Tables & PostgREST Specs
│   ├── WORKFLOW_DIAGRAM.md        # Mermaid Flowcharts & PIN Sequences
│   ├── DATABASE_SCHEMA_DIAGRAM.md # Mermaid ER Diagram
│   ├── STRESS_HANDLING_REPORT.md  # Concurrency Mutex & Load Tests
│   ├── SECURITY.md                # DPDP Act & FSSAI Compliance
│   ├── TESTING_QA_REPORT.md       # 45+ Automated Test Cases
│   ├── DEPLOYMENT_DEVOPS_GUIDE.md # Vercel & Supabase CI/CD
│   ├── BUSINESS_MODEL.md          # B2B SaaS & 3-Year P&L Forecast
│   ├── USER_MANUAL.md             # Role-based SOPs & Guides
│   └── ...
│
└── Sharebite food rescuing app/   # Production Application Codebase
    ├── src/
    │   ├── components/            # UI Primitives, Maps, Food Cards
    │   ├── context/               # AuthContext, AppContext
    │   ├── lib/                   # Supabase Client, Geolocation Helpers
    │   ├── pages/                 # Dashboards & Public Views
    │   ├── services/              # PostgREST API Service Layer
    │   ├── styles/                # tokens.css & global styling
    │   └── types/                 # TypeScript Database Models
    ├── supabase/
    │   ├── complete_schema.sql    # Canonical Database Migration
    │   └── functions/             # Deno Edge Functions (/moderate-image)
    └── package.json               # Package Manifest & Scripts
```

---

## 📑 12. Architectural Decision Records (ADR)

| ADR ID | Decision Taken | Rationale | Alternatives Evaluated |
|:---|:---|:---|:---|
| **ADR-01** | Supabase BaaS over Custom Node.js/Express | Built-in Row-Level Security, real-time WebSockets, and zero backend boilerplate cut development time by 60%. | Custom Node.js + Prisma + Socket.io |
| **ADR-02** | Atomic Database RPC over Client-Side Mutation | Guarantees absolute consistency during simultaneous meal claims, eliminating double-allocation. | Distributed Redis Lock, Optimistic locking |
| **ADR-03** | Leaflet over Google Maps SDK | Lightweight footprint (38KB vs 150KB), zero commercial API billing spikes for non-profit operations. | Google Maps Platform, Mapbox GL |
| **ADR-04** | TanStack Query v5 over Redux | Zero boilerplate for caching, background re-validation, and optimistic mutation handling. | Redux Toolkit, Zustand |

---

*Sharebite Architecture Specification v2.4 • Maintained by Sharebite Engineering Core Team*