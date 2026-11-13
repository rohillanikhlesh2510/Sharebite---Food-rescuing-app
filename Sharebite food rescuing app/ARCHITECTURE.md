# 🏗️ Sharebite — Architecture Report

> **Food Rescuing App** | A platform connecting food donors, NGOs, riders, and acceptors to reduce food waste across India.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [User Roles & Flows](#user-roles--flows)
8. [Key Features](#key-features)
9. [Service Layer](#service-layer)
10. [Deployment](#deployment)
11. [Security](#security)
12. [Directory Structure](#directory-structure)

---

## 📌 Project Overview

**Sharebite** is a web-based food rescue platform built for the Indian market. It connects:
- **Food Donors** (restaurants, households, event organizers) who have surplus food
- **NGOs / Acceptors** who need food for the community
- **Riders / Volunteers** who handle food pickup and delivery
- **Admins** who moderate and verify the platform

The platform enables real-time food listing, claiming, map-based discovery, and delivery tracking — reducing food waste and feeding communities across India.

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend Framework** | React | ^19.2.8 |
| **Language** | TypeScript | ~6.0.2 |
| **Build Tool** | Vite | ^8.3.0 |
| **Routing** | React Router DOM | ^7.18.3 |
| **State & Data Fetching** | TanStack React Query | ^5.102.8 |
| **Backend / BaaS** | Supabase (PostgreSQL + Auth + Realtime + Storage) | ^2.116.0 |
| **Maps** | Leaflet + React-Leaflet | ^1.9.4 / ^5.0.0 |
| **Icons** | Lucide React | ^1.46.0 |
| **Date Utilities** | date-fns | ^4.4.0 |
| **Linting** | oxlint | ^1.81.0 |
| **Deployment** | Vercel | — |
| **Edge Functions** | Supabase Edge Functions (Deno) | — |

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS (Browser)                          │
│         Donor │ NGO │ Rider │ Acceptor │ Admin │ Community      │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel CDN / Hosting                         │
│              React + Vite SPA (Static Build)                    │
│                   dist/ → index.html SPA                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────────┐
          ▼                ▼                    ▼
┌─────────────────┐ ┌──────────────┐ ┌────────────────────┐
│  Supabase Auth  │ │ Supabase DB  │ │  Supabase Storage  │
│  (GoTrue JWT)   │ │ (PostgreSQL) │ │  (Food images,     │
│  OAuth + Email  │ │  + RLS       │ │   Profile avatars) │
└─────────────────┘ └──────┬───────┘ └────────────────────┘
                           │
                    ┌──────▼───────┐
                    │  Supabase    │
                    │  Realtime    │
                    │  (WebSocket) │
                    │  Chat/Track  │
                    └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  Edge Funcs  │
                    │  (Deno)      │
                    │  moderate-   │
                    │  image/      │
                    └──────────────┘
```

---

## ⚛️ Frontend Architecture

### Component Structure

```
src/
├── assets/              # Static assets (images, icons)
├── components/          # Reusable UI components
│   ├── auth/            # Auth-related components
│   ├── food/            # Food listing components
│   ├── layout/          # App layout (header, nav, shell)
│   ├── map/             # Leaflet map components
│   ├── states/          # Loading / empty / error states
│   └── ui/              # Base UI primitives (buttons, cards, etc.)
├── context/             # React Context providers (Auth, App state)
├── lib/                 # Utility libraries (supabase client, uuid, helpers)
├── pages/
│   ├── app/             # Authenticated app pages
│   ├── auth/            # Auth & registration pages
│   └── public/          # Public-facing pages (landing, about, how-it-works)
├── services/            # API service layer (Supabase queries)
├── styles/              # Global CSS & design tokens
└── types/               # TypeScript type definitions
```

### Routing Strategy

React Router DOM v7 with **SPA fallback** via Vercel rewrites (`/* → /index.html`).

| Route | Page | Access |
|-------|------|--------|
| `/` | LandingPage | Public |
| `/about` | AboutPage | Public |
| `/how-it-works` | HowItWorksPage | Public |
| `/login` | LoginPage | Public |
| `/signup` | SignupPage | Public |
| `/role-select` | RoleSelectPage | Public |
| `/donor-dashboard` | DonorDashboardPage | Donor |
| `/ngo-dashboard` | NGOClaimsDashboard | NGO / Acceptor |
| `/rider-dashboard` | RiderDashboardPage | Rider / Volunteer |
| `/community-dashboard` | BeneficiaryDashboardPage | Community |
| `/admin` | AdminPage | Admin |
| `/create-donation` | CreateDonationPage | Donor |
| `/discover` | DiscoverPage | Authenticated |
| `/map` | MapPage | Authenticated |
| `/chat` | ChatPage | Authenticated |
| `/impact` | ImpactDashboardPage | Authenticated |
| `/profile` | ProfilePage | Authenticated |
| `/notifications` | NotificationsPage | Authenticated |

### Build Optimization (Vite Code Splitting)

Vite manually chunks vendor libraries for optimal loading:

| Chunk | Libraries |
|-------|-----------|
| `vendor-react` | react, react-dom, react-router |
| `vendor-supabase` | @supabase/supabase-js |
| `vendor-leaflet` | leaflet, react-leaflet |
| `vendor-query` | @tanstack/react-query |
| `vendor-icons` | lucide-react |

---

## 🗄️ Backend Architecture

### Supabase Services Used

| Service | Purpose |
|---------|---------|
| **PostgreSQL** | Primary database with RLS policies |
| **GoTrue (Auth)** | Email/password + OAuth authentication |
| **Realtime** | WebSocket-based live chat and rider tracking |
| **Storage** | Food images, profile avatars, documents |
| **Edge Functions** | Image moderation (Deno runtime) |

### Edge Functions

#### `moderate-image/`
- **Runtime:** Deno
- **Purpose:** Auto-moderation of uploaded food images to filter inappropriate content before they go live
- **Trigger:** On food listing image upload

---

## 🗃️ Database Schema

### Core Tables

```
profiles          → User profiles (all roles)
food_listings     → Food donation listings by donors
reservations      → NGO/acceptor claims on food listings
donations         → Completed donation records
partners          → Verified partner organizations
favorites         → User-saved listings
notifications     → In-app notification log
pickup_events     → Pickup lifecycle events
impact_events     → Impact tracking (meals saved, CO2, etc.)
reports           → User-reported content (moderation)

riders            → Rider profiles
deliveries        → Delivery assignments
volunteer_tasks   → Volunteer task assignments
rider_ratings     → Post-delivery ratings

food_moderation   → AI/manual moderation queue
```

### Key Enums

| Enum | Values |
|------|--------|
| `user_role` | donor, receiver, volunteer, ngo, partner, admin, rider, household |
| `food_status` | available, reserved, partially_reserved, picked_up, completed, expired, cancelled |
| `reservation_status` | pending, confirmed, ready_for_pickup, picked_up, completed, cancelled, expired |

### Migrations History

| Migration File | Purpose |
|----------------|---------|
| `migration.sql` | Base schema v1 |
| `rider_delivery_migration.sql` | Rider & delivery tables |
| `moderation_migration.sql` | Content moderation tables |
| `chat_and_realtime_migration.sql` | Chat & real-time messaging |
| `ngo_discovery_migration.sql` | India NGO discovery system |
| `phase2_14_migration.sql` | Phase 2 extended features |
| `god_mode_migration.sql` | Admin god-mode controls |
| `profiles_rls_fix.sql` | RLS policy fixes for profiles |
| `web_fixes_migration.sql` | Web-specific patches |
| `complete_schema.sql` | Canonical merged schema v3 (idempotent) |

---

## 👤 User Roles & Flows

```
                        ┌─────────────┐
                        │   Landing   │
                        │    Page     │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │ Role Select │
                        └──────┬──────┘
          ┌────────┬───────────┼───────────┬─────────┐
          ▼        ▼           ▼           ▼         ▼
      Donor       NGO        Rider    Community    Admin
          │        │           │           │         │
          ▼        ▼           ▼           ▼         ▼
   Donor        NGO       Rider        Beneficiary Admin
   Dashboard  Dashboard  Dashboard     Dashboard  Panel
          │        │           │
          │        │      ┌────▼─────┐
          │        │      │ Delivery │
          │        │      │ Tasks    │
          ▼        ▼      └──────────┘
   Create     Claim
   Listing    Food
          │        │
          └────────┘
                │
         ┌──────▼──────┐
         │   Real-time  │
         │   Updates   │
         │   + Chat    │
         └─────────────┘
```

### Role Descriptions

| Role | Description |
|------|-------------|
| **donor** | Restaurants, households, event organizers listing surplus food |
| **ngo / acceptor** | NGOs and organizations claiming food for distribution |
| **rider / volunteer** | Handles physical pickup and delivery of food |
| **community** | Individual beneficiaries discovering available food |
| **partner** | Verified partner organizations (corporate, institutional) |
| **admin** | Platform administrators with full moderation access |

---

## ✨ Key Features

### 🍱 Food Listing System
- Donors create listings with food category, type (veg/non-veg/vegan), servings, images, location, and pickup window
- Listings auto-expire after `availableUntil` timestamp
- Partial reservations supported (`partially_reserved` status)
- Urgency flag for time-critical donations

### 🗺️ Map Discovery
- Leaflet-based interactive map showing nearby food listings and NGOs
- GPS-based distance calculation (`distanceKm`)
- India NGO Discovery System with 10+ categories and verification tiers:
  - `source_listed` → `contact_available` → `sharebite_verified`

### 🚴 Rider Delivery System
- Riders assigned to delivery tasks from the Rider Dashboard
- Real-time location tracking via `rider_location_updates` table + Supabase Realtime
- Post-delivery ratings system

### 💬 Real-time Chat
- Conversation types: `direct`, `donation`, `delivery`
- Message types: `text`, `image`, `location`, `system`
- Supabase Realtime WebSocket subscriptions

### 📊 Impact Dashboard
- Community-wide stats: meals saved, food redistributed (kg), CO2 saved, people reached
- Personal donor/NGO impact tracking

### 🔔 Notifications
- In-app notification system with types:
  - `reservation_created`, `reservation_confirmed`, `pickup_ready`, `pickup_completed`
  - `donation_created`, `donation_completed`, `listing_expiring`, `partner_verified`

### 🛡️ Content Moderation
- AI-powered image moderation via Supabase Edge Function (`moderate-image`)
- Manual report/flag system for users
- Admin god-mode panel for full platform oversight

---

## 🔧 Service Layer

All Supabase interactions are abstracted into typed service files:

| Service File | Responsibility |
|-------------|----------------|
| `auth.ts` | Login, signup, OAuth, role-based routing, demo users |
| `donations.ts` | CRUD for food listings |
| `claims.ts` | Reservation management (NGO claims) |
| `chat.ts` | Messaging and conversation management |
| `impact.ts` | Impact stats queries |
| `location.ts` | Geolocation utilities, nearby search |
| `ngo.ts` | NGO profile management |
| `ngoDiscovery.ts` | India NGO directory queries |
| `notifications.ts` | Notification read/list |
| `partners.ts` | Partner organization queries |

---

## 🚀 Deployment

| Config | Value |
|--------|-------|
| **Platform** | Vercel |
| **Framework** | Vite |
| **Output Dir** | `dist/` |
| **SPA Routing** | All routes rewrite to `/index.html` |
| **Build Command** | `tsc -b && vite build` |
| **Dev Server** | `localhost:3000` |
| **CI/CD** | GitHub Actions (`webpack.yml`) |

---

## 🔐 Security

| Feature | Implementation |
|---------|----------------|
| **Authentication** | Supabase GoTrue — JWT-based |
| **Authorization** | PostgreSQL Row-Level Security (RLS) on all tables |
| **OAuth** | Google / GitHub via Supabase Auth |
| **API Keys** | Stored in `.env` (never committed — `.gitignore`d) |
| **Image Safety** | Supabase Edge Function image moderation |
| **UUID Validation** | Custom `isValidUUID` utility to prevent injection |
| **Demo Mode** | Sandboxed demo users with fixed UUIDs for testing |

---

## 📁 Directory Structure

```
Sharebite food rescuing app/
│
├── 📄 index.html                  # App entry point
├── 📄 package.json                # Dependencies & scripts
├── 📄 vite.config.ts              # Vite + build config
├── 📄 vercel.json                 # Vercel SPA deployment config
├── 📄 tsconfig.json               # TypeScript config
├── 📄 .env                        # Environment variables (not committed)
├── 📄 .env.example                # Env variable template
│
├── 📂 src/
│   ├── 📂 assets/                 # Static files
│   ├── 📂 components/
│   │   ├── auth/                  # Auth UI components
│   │   ├── food/                  # Food card, list components
│   │   ├── layout/                # AppShell, Header, Nav
│   │   ├── map/                   # MapView, Markers
│   │   ├── states/                # Empty/loading/error states
│   │   └── ui/                    # Buttons, Modals, Badges
│   ├── 📂 context/                # AuthContext, AppContext
│   ├── 📂 lib/                    # supabase.ts, uuid.ts, utils
│   ├── 📂 pages/
│   │   ├── app/                   # Authenticated dashboards
│   │   ├── auth/                  # Login, Register pages
│   │   └── public/                # Landing, About, HowItWorks
│   ├── 📂 services/               # Supabase query services
│   ├── 📂 styles/                 # global.css, tokens.css
│   └── 📂 types/                  # index.ts — all TypeScript types
│
├── 📂 supabase/
│   ├── complete_schema.sql        # Canonical DB schema (run this)
│   ├── migration.sql              # Base migration
│   ├── *.sql                      # Feature migrations
│   └── functions/
│       └── moderate-image/        # Deno edge function
│
└── 📂 design-system/              # Design tokens & guidelines
```

---

## 📈 Architecture Decisions & Patterns

| Decision | Rationale |
|----------|-----------|
| **Supabase over custom backend** | Faster development, built-in Auth, Realtime, Storage, RLS |
| **React Query** | Server state management with caching, background refetch |
| **CSS Modules** | Scoped styles per component, no class name conflicts |
| **Code splitting** | Vite `manualChunks` to reduce initial bundle size |
| **SPA + Vercel rewrites** | Client-side routing with clean URLs |
| **TypeScript strict types** | All DB entities typed in `types/index.ts` matching Supabase schema |
| **Service layer abstraction** | Business logic separated from UI components |
| **Demo mode** | Fixed UUID demo users allow testing without real auth |

---

*Report generated on: November 2026 | Sharebite v1.0*
