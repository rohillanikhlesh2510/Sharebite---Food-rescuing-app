# 🗺️ Sharebite — Product Roadmap & Scalability Vision (2026 – 2028)

> The strategic engineering roadmap, architectural milestones, and ecosystem expansion plan to scale Sharebite into India's national real-time food rescue grid.

---

## 📋 Table of Contents

1. [Strategic Vision & The Zero-Waste Mission](#-1-strategic-vision--the-zero-waste-mission)
2. [Timeline Horizon at a Glance](#-2-timeline-horizon-at-a-glance)
3. [Phase 0: The Core Engine (v1.0 — Current Production)](#-3-phase-0-the-core-engine-v10--current-production)
4. [Phase 1: Deepening Urban Reach & Frictionless Channels (Q1 – Q2 2027)](#-4-phase-1-deepening-urban-reach--frictionless-channels-q1--q2-2027)
5. [Phase 2: IoT Cold-Chain, Corporate CSR & Predictive AI (Q3 – Q4 2027)](#-5-phase-2-iot-cold-chain-corporate-csr--predictive-ai-q3--q4-2027)
6. [Phase 3: National Food Infrastructure & Public Partnerships (2028+)](#-6-phase-3-national-food-infrastructure--public-partnerships-2028)
7. [Technical Scalability & Infrastructure Roadmap](#-7-technical-scalability--infrastructure-roadmap)
8. [Community RFCs & Feature Request Process](#-8-community-rfcs--feature-request-process)

---

## 🌟 1. Strategic Vision & The Zero-Waste Mission

Sharebite's mission is to eliminate edible food waste in India by deploying high-velocity, real-time spatial logistics. Our strategic destination is transitioning from a **reactive web application** to an **ambient, AI-orchestrated national food redistribution grid**.

```
  v1.0 (Current)                  v2.0 (2027)                     v3.0 (2028+)
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│ Reactive Web Portal    │      │ Multi-Channel Engine   │      │ National Food Grid     │
│ - Donors list on web   │ ───► │ - WhatsApp AI Bot      │ ───► │ - Mandi Surplus Supply │
│ - NGOs claim on map    │      │ - Cold-Chain IoT       │      │ - PM POSHAN Mid-Day    │
│ - Manual dispatch      │      │ - CSR 80G Tax Automation│      │ - Carbon Credit Tokens │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

---

## ⏱️ 2. Timeline Horizon at a Glance

| Phase | Horizon | Focus Area | Target Milestones |
|:---|:---:|:---|:---|
| **Phase 0** | **Live** | Web Core & Security | 19 DB tables, RLS, Leaflet GPS, Deno Edge AI, 6-char Handover PIN |
| **Phase 1** | **Q1–Q2 2027** | Accessibility & Mobility | WhatsApp Bot listing, PWA Offline Sync, Bhasha AI (Hindi + 6 languages) |
| **Phase 2** | **Q3–Q4 2027** | Enterprise & Intelligence | IoT temperature tags, Automated 80G tax receipts, Multi-hop rider batching |
| **Phase 3** | **2028+** | National Scale | APMC Mandi post-harvest rescue, Mid-Day Meal integration, ESG carbon tokens |

---

## ✅ 3. Phase 0: The Core Engine (v1.0 — Current Production)

The foundational platform is fully implemented, verified, and active in production:

- [x] **React 19 & TypeScript 6 Architecture**: Modern concurrent rendering with Vite manual vendor code-splitting.
- [x] **PostgreSQL 15 & 100% RLS Coverage**: Complete transactional data security across all 19 relational tables.
- [x] **Atomic Claim Mutex (`reserve_food`)**: Row-level locking preventing inventory over-allocation under load.
- [x] **Serverless AI Image Moderation**: Deno edge function integrating HuggingFace vision models + SHA-256 deduplication.
- [x] **Anti-Fraud Handover Handshake**: 6-character alphanumeric pickup and dropoff verification codes.
- [x] **Haversine Distance Engine**: Spatial mathematical queries returning proximity-ranked food listings in `< 8 ms`.
- [x] **Supabase Realtime WebSockets**: Live messaging channels and field rider GPS telemetry tracking.
- [x] **Statutory Compliance**: Full alignment with India's **DPDP Act 2023** and **FSSAI Food Safety** protocols.

---

## 📱 4. Phase 1: Deepening Urban Reach & Frictionless Channels (Q1 – Q2 2027)

Focuses on removing all friction for kitchen staff, catering managers, and riders operating in the field.

### 4.1 WhatsApp Business Conversational AI Bot
- **Rationale**: Indian restaurant chefs and banquet caterers rarely open web dashboards at 11:30 PM, but 100% use WhatsApp.
- **Workflow**:
  - Donors send a photo and a brief voice note to Sharebite's WhatsApp bot: *"20 kg vegetable pulao ready at Grand Palace, pick up by 1 AM."*
  - Whisper Speech-to-Text converts audio to structured parameters (servings, category, expiry).
  - Webhook automatically provisions a live listing on `food_listings` without requiring app login.

### 4.2 Progressive Web App (PWA) with Offline Background Sync
- **Service Worker Caching**: Immediate boot time on budget Android smartphones under flaky 2G/3G connectivity.
- **Offline Outbox (IndexedDB)**: Riders can confirm pickup code verification offline; encrypted payloads queue and sync the millisecond cell tower signal reconnects.

### 4.3 Multilingual Interface (Bhasha AI)
- Native support for **8 Indian languages**:
  - 🇮🇳 Hindi (हिन्दी), Marathi (मराठी), Tamil (தமிழ்), Telugu (తెలుగు), Bengali (বাংলা), Kannada (ಕನ್ನಡ), Gujarati (ગુજરાતી), and Punjabi (ਪੰਜਾਬੀ).
- Automatic transliteration of addresses and vocal instructions for delivery riders.

### 4.4 Automated Push Notifications (Expo / Web Push)
- Real-time geofenced notifications: *"Hot surplus food available 800 meters from your shelter. 30 servings remaining."*

---

## 🧊 5. Phase 2: IoT Cold-Chain, Corporate CSR & Predictive AI (Q3 – Q4 2027)

Focuses on enterprise compliance, large-scale hotel chains, and perishable food preservation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2 ARCHITECTURE                            │
├─────────────────────┬────────────────────┬─────────────────────────────┤
│   COLD-CHAIN IOT    │ CSR TAX ENGINE     │ PREDICTIVE DEMAND AI        │
│ BLE / MQTT Sensors  │ Auto 80G Receipts  │ Festivity & Weather Forecast│
│ Temp & Spoilage Log │ Income Tax Portal  │ Pre-emptive Rider Dispatch  │
└─────────────────────┴────────────────────┴─────────────────────────────┘
```

### 5.1 IoT Cold-Chain & Spoilage Telemetry
- Bluetooth Low Energy (BLE) / MQTT sensor integration inside volunteer delivery containers.
- Continuous temperature (`< 5°C` refrigerated or `> 60°C` hot-holding) and humidity logging.
- Auto-cancels batch and alerts receiving NGO if temperature thresholds are breached in transit.

### 5.2 Corporate 80G Tax Exemption Automation
- Automatic generation of digitally signed **Form 10BE (80G)** tax deduction certificates for corporate donors.
- Integrates directly with verified NGO trusts and institutional hotel chains (Taj, Marriott, ITC).
- Verified impact certificates showing meals contributed, CO₂e diverted, and tax-deductible fair market value.

### 5.3 Multi-Hop Logistics Dispatch (Traveling Salesman Routing)
- Upgrades rider dispatch from 1:1 delivery to multi-stop pickup batching:
  - Rider picks up from Banquet Hall A ➔ Banquet Hall B ➔ Delivers combined batches to Mega-Shelter C.
  - Decreases transport emissions by **42%** and increases rider earnings per hour.

### 5.4 Predictive Surplus AI Engine
- Machine learning models trained on historical calendar events, wedding *muhurats*, festivals (Diwali, Eid, weddings), and localized weather forecasts.
- Sends proactive staging alerts to NGOs and riders 6 hours *before* banquets conclude.

---

## 🏛️ 6. Phase 3: National Food Infrastructure & Public Partnerships (2028+)

Transforming Sharebite into critical civic infrastructure connecting agriculture, government programs, and carbon markets.

### 6.1 APMC Mandi Post-Harvest Surplus Rescue
- Post-harvest discards at agricultural wholesale markets (Azadpur Mandi Delhi, Vashi Navi Mumbai) account for millions of tonnes of fresh vegetables.
- Bulk logistical routing linking farmers' associations with centralized institutional community kitchens (e.g. Akshaya Patra, ISKCON Food for Life).

### 6.2 Government Mid-Day Meal (PM POSHAN) Integration
- Direct API integration with municipal school databases to supplement government child nutrition programs with verified, high-protein bakery and fruit surplus.

### 6.3 Carbon Credit Tokenization & ESG Ledger
- Converts audited CO₂e reductions into verified **Voluntary Carbon Offsets (VCOs)**.
- Enterprise food chains trade carbon credits or publish audited ESG reports for SEBI BRSR (Business Responsibility and Sustainability Reporting) filings.

### 6.4 Community Smart Fridges in Urban Slums
- Self-service refrigerated kiosks installed in public transit stations and slum clusters, unlocked via beneficiary QR passes.

---

## ⚙️ 7. Technical Scalability & Infrastructure Roadmap

To handle our target of **10 million meals per month by 2028**, our infrastructure will scale through the following milestones:

```
Current: Single Supabase DB ──► Read Replicas (Q2 2027) ──► Citus PostGIS Sharding (2028)
```

| Component | Current Architecture | Scaled Target (Phase 2 & 3) |
|:---|:---|:---|
| **Database Sharding** | Single PostgreSQL 15 instance | PostGIS geo-partitioning by State / Telecom Circle |
| **Caching Layer** | TanStack Client-side Query cache | Redis / Dragonfly distributed in-memory cache for spatial bounding boxes |
| **Edge Compute** | Single region Deno edge functions | Multi-region Deno deployment with localized model weights |
| **Object Storage** | Supabase S3 bucket | Cloudflare R2 with global zero-egress CDN caching |
| **Telemetry Ingestion**| Direct HTTP table insert | Apache Kafka / RabbitMQ stream buffer for high-velocity GPS updates |

---

## 🤝 8. Community RFCs & Feature Request Process

We believe food rescue infrastructure should be built transparently with the community:

1. **Submit a Request for Comments (RFC)**:
   - Propose architectural changes by opening a GitHub Discussion under the `RFC: Proposals` category.
2. **Review Criteria**:
   - Every proposal is evaluated on: **Speed to Deploy**, **Mobile Field Reliability**, and **Impact on Food Waste Reduction**.
3. **Pilot City Testing**:
   - Experimental features are soft-launched in designated pilot regions (e.g. Bhopal & Central Delhi) before national rollout.

---

<div align="center">

### 🌱 Dedicated to a Hunger-Free, Sustainable India 🇮🇳

**[Join the Discussion on GitHub](https://github.com/rohillanikhlesh2510/Sharebite---Food-rescuing-app/discussions)** • **[Explore Technical Docs](./README.md)**

</div>
