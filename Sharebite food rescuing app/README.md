<div align="center">

# 🍽️ Sharebite — Food Rescuing App

**Connecting food donors, NGOs, riders, and communities to eliminate food waste across India.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

</div>

---

## 🌟 What is Sharebite?

**Sharebite** is a full-stack web platform that bridges the gap between food surplus and food scarcity. Every day, tonnes of perfectly good food is wasted while millions go hungry. Sharebite solves this by creating a real-time, map-driven ecosystem where:

- 🏪 **Donors** (restaurants, households, event organizers) list surplus food in minutes
- 🏢 **NGOs & Acceptors** discover and claim food near them
- 🚴 **Riders & Volunteers** handle pickup and last-mile delivery
- 🌍 **Communities** find available food resources on a live map
- 🛡️ **Admins** moderate, verify, and manage the entire platform

---

## 📸 Screenshots

> *Landing Page · Donor Dashboard · NGO Discovery Map · Rider Dashboard*

---

## ✨ Features

### 🍱 Food Listing & Rescue
- Create food listings with category, type (veg / non-veg / vegan), servings, photos, and pickup window
- Urgency flag for time-critical donations
- Partial reservations — multiple NGOs can claim portions of the same listing
- Auto-expiry when `availableUntil` is reached

### 🗺️ Map-Based Discovery
- Interactive Leaflet map showing nearby food listings and NGOs
- GPS-based distance sorting
- **India NGO Discovery System** — browse 10+ categories of verified NGOs across states

### 🚴 Rider Delivery System
- Riders assigned delivery tasks from their dedicated dashboard
- Real-time GPS location tracking via Supabase Realtime
- Post-delivery ratings and feedback

### 💬 Real-time Chat
- In-app messaging between donors, NGOs, and riders
- Conversation types: `direct`, `donation-linked`, `delivery-linked`
- Supports text, image, location, and system messages

### 📊 Impact Dashboard
- Community-wide stats: **meals saved**, **food redistributed (kg)**, **CO₂ saved**, **people reached**
- Personal donor and NGO impact tracking

### 🔔 Smart Notifications
- Real-time in-app notifications for every stage of the food rescue lifecycle
- Types: reservation confirmed, pickup ready, donation completed, listing expiring, and more

### 🛡️ Content Moderation
- AI-powered food image moderation via Supabase Edge Functions (Deno)
- User-flagging and report system
- Admin god-mode panel for full platform oversight

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 19, TypeScript 6, CSS Modules |
| **Build** | Vite 8 (with manual code splitting) |
| **Routing** | React Router DOM v7 |
| **Server State** | TanStack React Query v5 |
| **Backend / BaaS** | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| **Maps** | Leaflet + React-Leaflet |
| **Icons** | Lucide React |
| **Edge Functions** | Supabase Edge Functions (Deno runtime) |
| **Linting** | oxlint |
| **Deployment** | Vercel |

---

## 👤 User Roles

| Role | Description |
|------|-------------|
| `donor` | Restaurants, households, orgs listing surplus food |
| `ngo` / `acceptor` | NGOs and orgs claiming food for communities |
| `rider` / `volunteer` | Handles pickup and delivery of food |
| `community` | Individual beneficiaries finding food near them |
| `partner` | Verified corporate/institutional partners |
| `admin` | Platform moderators with full access |

---

## 🗄️ Database Schema (Supabase / PostgreSQL)

Key tables with Row-Level Security (RLS) enabled:

```
profiles          → User profiles for all roles
food_listings     → Donor food posts
reservations      → NGO/acceptor claims
donations         → Completed donation records
partners          → Verified partner orgs
notifications     → In-app notification log
pickup_events     → Pickup lifecycle tracking
impact_events     → Meals saved, CO₂, people reached
riders            → Rider profiles
deliveries        → Delivery assignments
chat_messages     → Real-time messaging
food_moderation   → AI + manual moderation queue
reports           → User-flagged content
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone the repository

```bash
git clone https://github.com/rohillanikhlesh2510/Sharebite---Food-rescuing-app.git
cd "Sharebite---Food-rescuing-app/Sharebite food rescuing app"
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set up the database

Go to your Supabase project → SQL Editor → New Query.
Paste and run the contents of:

```
supabase/complete_schema.sql
```

> This is the canonical, idempotent schema — safe to run multiple times.

### 5. Start the development server

```bash
npm run dev
```

App runs at **http://localhost:3000** 🎉

---

## 📦 Build & Deploy

```bash
# Production build
npm run build

# Preview production build locally
npm run preview

# Lint
npm run lint
```

### Deploy to Vercel

This project is pre-configured for Vercel:

```bash
vercel deploy
```

The `vercel.json` rewrites all routes to `index.html` for SPA routing.

---

## 📂 Project Structure

```
Sharebite food rescuing app/
│
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── auth/          # Auth UI components
│   │   ├── food/          # Food cards & lists
│   │   ├── layout/        # App shell, header, nav
│   │   ├── map/           # Leaflet map components
│   │   └── ui/            # Base UI primitives
│   │
│   ├── pages/
│   │   ├── app/           # Authenticated dashboards
│   │   ├── auth/          # Login & registration
│   │   └── public/        # Landing, About, How It Works
│   │
│   ├── services/          # Supabase query services
│   ├── context/           # React Context (Auth, App)
│   ├── lib/               # Supabase client, utilities
│   ├── types/             # TypeScript type definitions
│   └── styles/            # Global CSS & design tokens
│
├── supabase/
│   ├── complete_schema.sql    # ← Run this to set up DB
│   ├── functions/
│   │   └── moderate-image/    # Deno image moderation
│   └── *.sql                  # Feature migration files
│
├── ARCHITECTURE.md        # Detailed architecture report
├── vercel.json            # Vercel deployment config
├── vite.config.ts         # Vite build config
└── package.json
```

---

## 🔐 Security

- **JWT Authentication** via Supabase GoTrue
- **Row-Level Security (RLS)** on every database table
- **OAuth Support** (Google, GitHub)
- **AI Image Moderation** via Supabase Edge Functions
- **Environment variables** never committed (`.env` in `.gitignore`)

---

## 📖 Documentation

- [Architecture Report](./ARCHITECTURE.md) — Full system design, DB schema, flow diagrams

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the terms of the [LICENSE](./LICENSE) file.

---

<div align="center">

Made with ❤️ to fight food waste in India 🇮🇳

**[GitHub](https://github.com/rohillanikhlesh2510/Sharebite---Food-rescuing-app)**

</div>
