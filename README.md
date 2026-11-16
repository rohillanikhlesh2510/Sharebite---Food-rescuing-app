<div align="center">

# 🍽️ SHAREBITE — Food Rescuing & Redistribution Platform

### *Bridging the Gap Between Surplus Food and Scarcity Across India*

[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_15-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Leaflet](https://img.shields.io/badge/Leaflet-Maps_&_Geo-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com)
[![TanStack Query](https://img.shields.io/badge/TanStack-React_Query_v5-FF4154?style=for-the-badge&logo=react-query&logoColor=white)](https://tanstack.com/query)
[![Vercel](https://img.shields.io/badge/Deployment-Vercel_Edge-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)

<br/>

<p align="center">
  <a href="#-project-overview">Overview</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-user-roles--workflows">User Roles</a> •
  <a href="#-interactive-visual-walkthrough">Screenshots</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quickstart-guide">Quickstart</a> •
  <a href="#-technical-documentation-hub">Docs Hub</a> •
  <a href="#-environmental--social-impact">Impact</a>
</p>

---

</div>

## 📌 Executive Summary

Every year, India discards **68.8 million tonnes** of edible food while over **194 million people** experience chronic undernourishment. Surplus food produced by restaurants, caterers, hotels, and households spoils rapidly due to a lack of immediate, localized distribution channels.

**Sharebite** is an enterprise-grade, real-time food rescue ecosystem built specifically for Indian cities. It coordinates **Food Donors**, **Verified NGOs**, **Logistics Riders**, and **Local Communities** through an intelligent, map-driven web application powered by **Supabase PostgreSQL**, **Realtime WebSockets**, and **AI-assisted food verification**.

```
    [ 🏪 Food Donor ] ──( 3-Min Listing )──> [ ⚡ Sharebite Platform ]
                                                     │
               ┌─────────────────────────────────────┴─────────────────────────────────────┐
               ▼                                                                           ▼
      [ 🏢 Verified NGO ]                                                        [ 🚴 Rescue Rider ]
      - GPS-based proximity claim                                                - 6-character Handover PIN
      - Distribution tracking                                                    - Live turn-by-turn route
               │                                                                           │
               └───────────────────────────┬───────────────────────────────────────────────┘
                                           ▼
                           [ 🍲 Community Fed · Zero Waste ]
```

---

## 🏛️ System Architecture

Sharebite follows a modern, decoupled Cloud-Native architecture:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT TIER (Browser / Mobile Web)                      │
│   React 19 SPA · TanStack Query v5 · Leaflet GPS Engine · Role-Based Navigation Guard  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTPS / WebSocket (WSS)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  VERCEL GLOBAL EDGE CDN                                │
│           Optimized Single-Page Application (SPA) Serving · Brotli Compression         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
┌─────────────────────────────┐ ┌──────────────────────┐ ┌───────────────────────────────┐
│     SUPABASE AUTH (GoTrue)  │ │   SUPABASE STORAGE   │ │   DENO EDGE FUNCTIONS         │
│  - JWT (RS256/HS256)        │ │  - S3-compatible     │ │  - moderate-image             │
│  - Email/Password + OAuth   │ │  - Food Photos       │ │  - HuggingFace ViT Classifier │
│  - RBAC Token Claims        │ │  - Avatars & Badges  │ │  - SHA-256 Duplicate Blocker  │
└─────────────────────────────┘ └──────────────────────┘ └───────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL 15 DATA ENGINE                                 │
│  - Row-Level Security (RLS) on all 19 Tables                                           │
│  - Transactional Stored Procedures (`reserve_food`, `assign_rider_to_delivery`)        │
│  - PostGIS / Haversine Spatial Distance Indexing (`get_nearby_food`, `nearby_ngos`)    │
│  - Realtime CDC (Change Data Capture) Replication via Phoenix Channels                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📸 Interactive Visual Walkthrough

Here is a visual overview of Sharebite's user interface across different user journeys:

| 01. Landing & Value Proposition | 02. Role Selection Experience |
|:---:|:---:|
| <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/01-landing-hero.png" width="100%" alt="Landing Page"/> | <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/02-role-selection.png" width="100%" alt="Role Selection"/> |
| *Hero section with impact metrics and direct CTA* | *Dedicated role onboarding for Donors, NGOs & Riders* |

| 03. Donor Dashboard & Active Deliveries | 04. 3-Step Donation Creation Wizard |
|:---:|:---:|
| <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/06-donor-dashboard.png" width="100%" alt="Donor Dashboard"/> | <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/07-create-donation.png" width="100%" alt="Create Donation"/> |
| *Real-time listing status, live rider ETA, and impact counters* | *Smart geocoding, interactive pin placement & dietary tags* |

| 05. NGO Claims & Receipt Confirmation | 06. Logistics & Rider Fleet Hub |
|:---:|:---:|
| <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/08-ngo-claims.png" width="100%" alt="NGO Claims Dashboard"/> | <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/09-rider-dashboard.png" width="100%" alt="Rider Dashboard"/> |
| *End-to-end claim lifecycle with condition and quantity verification* | *Task dispatch, route navigation & 6-character pickup OTP* |

| 07. Interactive Real-Time Food Map | 08. All-India NGO Discovery Engine |
|:---:|:---:|
| <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/10-interactive-map.png" width="100%" alt="Interactive Food Map"/> | <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/11-ngo-discovery.png" width="100%" alt="NGO Discovery"/> |
| *Leaflet-powered spatial exploration with dynamic radius filtering* | *Over 12 categories of verified NGOs across Indian states* |

| 09. Real-Time Chat & Handover Coordination | 10. Community Environmental Impact Hub |
|:---:|:---:|
| <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/13-chat-coordination.png" width="100%" alt="Chat & Coordination"/> | <img src="Sharebite%20food%20rescuing%20app/docs/screenshots/12-impact-dashboard.png" width="100%" alt="Impact Dashboard"/> |
| *Supabase WebSocket chat linking donors, riders, and recipients* | *Live calculations for CO₂e prevented, water saved & meals rescued* |

---

## 👥 User Roles & Workflows

Sharebite enforces strict Role-Based Access Control (**RBAC**), providing personalized workflows for each stakeholder:

```
                               ┌────────────────────────────────┐
                               │     Authentication & Auth      │
                               └───────────────┬────────────────┘
                                               │
               ┌───────────────────┬───────────┴───────────┬───────────────────┐
               ▼                   ▼                       ▼                   ▼
        [ 🏪 Donor ]         [ 🏢 NGO ]             [ 🚴 Rider ]         [ 🛡️ Admin ]
        • Create Listings    • Discover Food         • View Nearby Jobs  • Verify Users
        • Track Claims       • Reserve Batches       • Accept Delivery   • Approve Listings
        • Coordinate Rider   • Confirm Receipt       • Verify PIN Code   • System Health
        • View CO₂ Saved     • Track Distribution    • Incident Report   • Audit Logs
```

### 1. 🏪 Food Donors (Restaurants, Caterers, Households)
- **Fast 3-Step Listing**: Dietary type (`veg`, `non-veg`, `vegan`), servings, shelf-life expiry, and storage conditions (`ambient`, `refrigerated`, `hot-holding`).
- **Interactive Map Pinning**: Drag-and-drop Leaflet marker with reverse-geocoding to set pickup coordinates.
- **Handover Security**: Unique 6-character alphanumeric handover code generated to verify identity of dispatch riders.

### 2. 🏢 NGOs & Community Kitchens
- **Dynamic Reservations**: Claim full or partial portions of food donations with transactional integrity.
- **Quality & Safety Assurance**: Mandatory condition check and discrepancy reporting upon arrival.
- **Distribution Logs**: Track people served and remaining quantities for public impact auditing.

### 3. 🚴 Logistics Riders & Volunteers
- **Geographic Dispatch**: Browse nearby delivery tasks sorted by calculated road distance.
- **Two-Step Verification**: Enter donor pickup code + NGO dropoff code to prevent fraud.
- **Real-Time GPS Broadcast**: Broadcast live coordinates to both donor and recipient via WebSockets.

### 4. 🛡️ System Administrators
- **Platform Verification**: Review legal NGO registration numbers (Darpan/Trust deeds) and rider licenses.
- **Automated Moderation Queue**: Inspect AI-flagged uploads and user reports.
- **High-Altitude Analytics**: Aggregate metrics across cities, food categories, and operational bottlenecks.

---

## ✨ Key Features & Technical Highlights

### 🧠 1. Serverless AI Image Moderation (Deno Edge)
Every food photo uploaded is processed by the `moderate-image` Supabase Edge Function:
- **Magic-Byte Inspection**: Binary validation ensuring only legitimate JPEG, PNG, and WebP payloads are parsed.
- **SHA-256 Hash Deduplication**: Immediate rejection of re-uploaded stock photos or duplicate listings.
- **Dual-Model Inference**: Integrates HuggingFace's `nateraw/food` and `google/vit-base-patch16-224` to verify genuine cooked food vs. non-food spam, memes, or screenshots.

### 📍 2. Haversine Spatial Discovery (PostgreSQL RPC)
- Implements custom spherical trigonometry queries directly in PostgreSQL (`get_nearby_food` and `nearby_ngos`).
- Sub-millisecond geographic proximity sorting without requiring external paid geocoding APIs.

### 🔒 3. Concurrency-Safe Transaction Engine
- Food reservation utilizes PostgreSQL `SELECT ... FOR UPDATE` row-level locks within the `reserve_food()` RPC.
- Guaranteed zero double-claiming when multiple NGOs attempt to reserve the same listing simultaneously.

### 💬 4. Integrated WebSocket Realtime Chat
- Bidirectional messaging linking Donors, Riders, and NGOs directly on a specific donation thread.
- Read receipts, image sharing, location drops, and auto-generated system audit notifications.

---

## 🛠️ Complete Tech Stack Matrix

| Layer | Technologies & Frameworks | Key Highlights |
|:---|:---|:---|
| **Frontend Framework** | **React 19.2** + **TypeScript 6.0** | Modern concurrent rendering, strict typing |
| **Tooling & Build** | **Vite 8.3** | Sub-second HMR, optimized manual vendor chunks |
| **State Management** | **TanStack React Query v5** + **React Context** | Stale-while-revalidate caching, zero prop-drilling |
| **Routing** | **React Router DOM v7** | Code-split lazy routes, role-based route guards |
| **Geo-Spatial / Maps** | **Leaflet 1.9** + **React-Leaflet 5.0** | Custom SVG markers, GPS tracking, responsive fly-to |
| **Design System** | **Vanilla CSS Modules** + Custom Design Tokens | Scoped zero-runtime styling, warm earth palette |
| **Icons & Media** | **Lucide React** + Unsplash Curated CDN | Lightweight SVG vectors, high-res fallback imagery |
| **Database & Auth** | **Supabase (PostgreSQL 15 + GoTrue)** | RLS policies, native UUIDs, pgcrypto, JWT auth |
| **Realtime Engine** | **Supabase Realtime (Phoenix Channels)** | WebSocket-based Change Data Capture (CDC) |
| **Edge Functions** | **Deno 1.30+** | TypeScript serverless runtime for image AI checks |
| **Static Hosting** | **Vercel** | Global edge network with client-side SPA rewrites |

---

## 🚀 Quickstart Guide

Follow these steps to run Sharebite on your local machine:

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- A free [Supabase Account](https://supabase.com)

### 1. Clone Repository
```bash
git clone https://github.com/rohillanikhlesh2510/Sharebite---Food-rescuing-app.git
cd "Sharebite---Food-rescuing-app/Sharebite food rescuing app"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Duplicate the provided example environment template:
```bash
cp .env.example .env
```
Populate your `.env` file with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Initialize Database Schema
1. Open your Supabase Dashboard → **SQL Editor**.
2. Click **New Query**.
3. Open [`supabase/complete_schema.sql`](./Sharebite%20food%20rescuing%20app/supabase/complete_schema.sql) from this repository.
4. Copy, paste, and click **Run**.
> *Note: This canonical schema is fully idempotent and initializes all 19 tables, enums, triggers, RLS policies, and RPC functions in one execution.*

### 5. Launch Development Server
```bash
npm run dev
```
Navigate to **`http://localhost:3000`** in your browser.

---

## 📚 Technical Documentation Hub

Sharebite includes an extensive suite of dedicated architectural specifications:

| Document | Focus & Highlights |
|:---|:---|
| 🔄 **[WORKFLOW_DIAGRAM.md](./WORKFLOW_DIAGRAM.md)** | Visual Mermaid workflows, swimlane lifecycles, and PIN verification sequence diagrams |
| 📊 **[DATABASE_SCHEMA_DIAGRAM.md](./DATABASE_SCHEMA_DIAGRAM.md)** | Complete Mermaid ER diagram, 19 tables, foreign key tree & cardinality mappings |
| ⚡ **[STRESS_HANDLING_REPORT.md](./STRESS_HANDLING_REPORT.md)** | Concurrency benchmarks, row-level locking, connection pooling & offline rider resilience |
| 🛡️ **[SECURITY.md](./SECURITY.md)** | DPDP Act 2023 compliance, RLS penetration threat matrix & FSSAI safety norms |
| 🏛️ **[ARCHITECTURE.md](./Sharebite%20food%20rescuing%20app/ARCHITECTURE.md)** | End-to-end system design, client-server data flow, vendor chunking strategy |
| 🗄️ **[BACKEND_REPORT.md](./Sharebite%20food%20rescuing%20app/BACKEND_REPORT.md)** | Detailed specification of all 19 DB tables, RPC procedures, RLS policies & triggers |
| 📡 **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** | Complete PostgREST endpoints, Stored Procedure RPC schemas & WebSocket events |
| ⚛️ **[FRONTEND_REPORT.md](./Sharebite%20food%20rescuing%20app/FRONTEND_REPORT.md)** | React 19 architecture, routing table, AuthContext state flow & Design Tokens |
| 🎨 **[UIUX_DESIGN_REPORT.md](./UIUX_DESIGN_REPORT.md)** | Visual identity, design tokens, WCAG 2.1 accessibility & Indian hospitality UX |
| 🌟 **[FEATURES.md](./Sharebite%20food%20rescuing%20app/FEATURES.md)** | Comprehensive module-by-module breakdown of all 25+ implemented user features |
| 🌍 **[IMPACT_REPORT.md](./Sharebite%20food%20rescuing%20app/IMPACT_REPORT.md)** | Environmental formulas (CO₂e, virtual water), hunger data & UN SDG mappings |
| 📁 **[FOLDER_STRUCTURE.md](./Sharebite%20food%20rescuing%20app/FOLDER_STRUCTURE.md)** | Granular directory map explaining the responsibility of every file |
| 🗺️ **[ROADMAP.md](./ROADMAP.md)** | Strategic vision (2026–2028), WhatsApp Bot, IoT cold-chain & APMC Mandi rescue |

---

## 📊 Environmental & Social Impact Metrics

Sharebite integrates real-time scientific impact formulas based on **UNEP** and **IPCC** methodologies:

$$\text{Food Rescued (kg)} = \text{Servings} \times 0.35\text{ kg}$$

$$\text{CO}_2\text{e Prevented (kg)} = \text{Food Rescued (kg)} \times 2.5$$

$$\text{Virtual Water Conserved (L)} = \text{Food Rescued (kg)} \times 1,000\text{ Litres}$$

### Impact Milestone Equivalencies
- **Every 1,000 Meals Rescued:**
  - 🌫️ **875 kg CO₂e** greenhouse gases avoided from landfills.
  - 💧 **350,000 Litres** of agricultural virtual water conserved.
  - 🚗 Equivalent to taking an average passenger car off Indian roads for **3,600 kilometers**.

### UN Sustainable Development Goals (SDG) Alignment
- **SDG 2 — Zero Hunger**: Direct redistribution of perishable calories to vulnerable communities.
- **SDG 12 — Responsible Consumption & Production**: Halving per-capita food waste at consumer & retail levels.
- **SDG 13 — Climate Action**: Mitigating fugitive methane emissions produced by decomposing organic matter.

---

## 🔒 Security & Data Integrity

- **Row-Level Security (RLS)**: Enforced on 100% of tables; unauthorized read/write attempts are blocked at the DB kernel level.
- **Type-Safe UUID Mapping**: Custom `toSafeUUID()` sanitizers prevent PostgreSQL format exceptions.
- **Environment Isolation**: Service keys remain exclusively within Supabase Edge Vaults; never bundled into client distributions.
- **Zero Double-Spend**: Atomic decrement logic guarantees servings cannot be over-claimed.

---

## 🤝 Contributing

We welcome contributions from engineers, designers, and food rescue organizations!

1. Fork the Project (`https://github.com/rohillanikhlesh2510/Sharebite---Food-rescuing-app/fork`)
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./Sharebite%20food%20rescuing%20app/LICENSE) for more details.

---

<div align="center">

Made with ❤️ for a hunger-free, sustainable India 🇮🇳

**[⭐ Star us on GitHub](https://github.com/rohillanikhlesh2510/Sharebite---Food-rescuing-app)**

</div>
