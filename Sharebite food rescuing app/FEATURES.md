# 🌟 Sharebite — Complete Feature Report

> Detailed documentation of every feature, module, and capability of the Sharebite Food Rescuing Platform.

---

## 📋 Table of Contents

1. [Feature Overview](#feature-overview)
2. [Authentication & Onboarding](#-authentication--onboarding)
3. [Donor Features](#-donor-features)
4. [NGO / Acceptor Features](#-ngo--acceptor-features)
5. [Rider / Volunteer Features](#-rider--volunteer-features)
6. [Community / Beneficiary Features](#-community--beneficiary-features)
7. [Admin Features](#-admin-features)
8. [Map & Discovery](#-map--discovery)
9. [Real-time Chat](#-real-time-chat)
10. [Impact & Analytics](#-impact--analytics)
11. [Notification System](#-notification-system)
12. [Content Moderation](#-content-moderation)
13. [India NGO Discovery System](#-india-ngo-discovery-system)
14. [Design System & UI](#-design-system--ui)
15. [Demo & Testing Mode](#-demo--testing-mode)
16. [Feature Status Summary](#-feature-status-summary)

---

## Feature Overview

| # | Feature Area | Pages / Components | Status |
|---|-------------|-------------------|--------|
| 1 | Authentication & Onboarding | 10 pages | ✅ Live |
| 2 | Food Listing (Donation) | CreateDonationPage, DonationsPage | ✅ Live |
| 3 | Donor Dashboard | DonorDashboardPage | ✅ Live |
| 4 | NGO Claims System | NGOClaimsDashboard | ✅ Live |
| 5 | Rider Delivery System | RiderDashboardPage | ✅ Live |
| 6 | Community Dashboard | BeneficiaryDashboardPage | ✅ Live |
| 7 | Admin Control Panel | AdminPage | ✅ Live |
| 8 | Interactive Map | MapPage, DiscoverPage | ✅ Live |
| 9 | India NGO Discovery | NGODiscoveryPage | ✅ Live |
| 10 | Real-time Chat | ChatPage | ✅ Live |
| 11 | Impact Dashboard | ImpactDashboardPage | ✅ Live |
| 12 | Notification Center | NotificationsPage | ✅ Live |
| 13 | Image Moderation | Supabase Edge Function | ✅ Live |
| 14 | Profile & Settings | ProfilePage, SettingsPage | ✅ Live |
| 15 | Demo / Testing Mode | All dashboards | ✅ Live |

---

## 🔐 Authentication & Onboarding

### 1.1 — Multi-Role Registration

The platform supports **3 dedicated registration flows**, each collecting role-specific information:

#### Donor Registration (`DonorRegisterPage`)
- Full name, email, password
- Organization name (restaurant, hotel, NGO, event company, household)
- Phone number & city
- Address with optional map pin
- Bio / description
- Profile photo upload

#### NGO / Acceptor Registration (`AcceptorRegisterPage`)
- Organization name & type
- NGO registration number
- Contact person name & designation
- Address & service area
- Operating hours
- Accepts food donations toggle
- Accepts volunteers toggle

#### Rider Registration (`RiderRegisterPage`)
- Personal details & photo
- Vehicle type (bike, bicycle, auto, car)
- Availability hours
- Service area / city
- Emergency contact

---

### 1.2 — Login & Auth Flows

| Flow | Description |
|------|-------------|
| **Email + Password Login** | Standard email/password with Supabase Auth |
| **OAuth (Google / GitHub)** | One-click social login via Supabase GoTrue |
| **Role-based Redirect** | After login, user is auto-redirected to their role's dashboard |
| **Forgot Password** | Email-based password reset link (ForgotPasswordPage) |
| **Reset Password** | Secure new password form (ResetPasswordPage) |
| **Auth Callback** | Handles OAuth redirect tokens (AuthCallbackPage) |

---

### 1.3 — Role Selection (`RoleSelectPage`)

- Visual role selector with illustrated cards for: **Donor**, **NGO/Acceptor**, **Rider/Volunteer**
- Each card shows role description and what the user can do
- Leads to the appropriate registration form

---

### 1.4 — Route Guard (`RoleRouteGuard`)

- All authenticated routes are protected
- Checks user role and redirects to the correct dashboard
- Prevents role-switching (e.g., a rider can't access the NGO dashboard)

---

## 🍽️ Donor Features

### 2.1 — Donor Dashboard (`DonorDashboardPage`)

The central hub for food donors showing:

#### Stats Cards (Live)
| Stat | Source |
|------|--------|
| Total Donations Made | `ImpactService.getUserImpact()` |
| Active Listings Count | `DonationService.getMyListings()` |
| Meals Saved | From impact events |
| CO₂ Prevented (kg) | Calculated from food rescued |

#### Active Listings Panel
- Shows all current food listings with status badges
- Real-time status: `available`, `reserved`, `partially_reserved`, `picked_up`, `completed`, `expired`
- Quick actions: Edit, Cancel, View claims
- Distance to nearest NGO shown

#### Live Delivery Tracker
- If a rider is assigned to a food pickup, the donor sees:
  - Rider name & phone
  - Current delivery status (e.g., `going_to_pickup`, `food_collected`, `in_transit`)
  - Estimated completion time
  - Direct chat button to message the rider

#### Quick Actions
- **+ Create New Donation** → navigates to Create Donation
- **Discover Nearby NGOs** → navigates to NGO Discovery
- **View Impact** → navigates to Impact Dashboard

---

### 2.2 — Create Food Listing (`CreateDonationPage`)

A **3-step wizard** for creating food donations:

#### Step 1 — Food Details
| Field | Options |
|-------|---------|
| **Food Title** | Text input |
| **Description** | Multi-line text |
| **Category** | Rice, Roti, Sabzi, Dal, Biryani, Curry, Snacks, Sweets, Fruits, Bakery, Beverages, Other |
| **Food Type** | Vegetarian, Non-Vegetarian, Vegan, Special/Other |
| **Quantity** | Number + unit (Servings, kg, Boxes, Litres, Catering Trays) |
| **Storage Type** | Room Temp, Refrigerated, Frozen, Hot Holding |
| **Packaging Type** | Sealed Boxes, Catering Trays, Food-grade Packaged, Bulk/BYOC |
| **Allergens** | Multi-select: Dairy, Gluten, Nuts, Peanuts, Soy, Eggs, Seafood, Mustard, None |
| **Preparation Date** | Date picker |
| **Photo Upload** | Image file → Supabase Storage → AI moderation |
| **Urgency Flag** | Toggle: marks listing as urgent (highlighted in red) |

#### Step 2 — Pickup & Safety
| Field | Description |
|-------|-------------|
| **Pickup Address** | Auto-detect via GPS or manual text entry |
| **Interactive Map Pin** | Drag-and-drop Leaflet map to set exact pickup location |
| **Reverse Geocoding** | Address auto-fills from map pin using LocationService |
| **City** | Auto-detected from GPS |
| **Pickup Date & Time Window** | Start and end time for pickup availability |
| **Special Instructions** | Custom notes for the rider/NGO |
| **Direct Handover Toggle** | Donor will hand food directly (no rider needed) |
| **Contact Phone** | Alternative contact during pickup |
| **Safety Declaration** | Checkbox: donor confirms food is safe & fit for distribution |

#### Step 3 — Review & Publish
- Full preview of the listing before publishing
- Edit any step before submission
- Publishes to `food_listings` table with status `available`

---

### 2.3 — Donation Status Tracker (`DonorDonationsStatus`)

- Full history of all past and active donations
- Status timeline for each listing
- Expandable claim details (which NGOs claimed, how many servings, delivery status)
- Cancel listing option (with reason)

---

## 🏢 NGO / Acceptor Features

### 3.1 — NGO Claims Dashboard (`NGOClaimsDashboard`)

The core workflow screen for NGOs claiming and managing food:

#### Claim Lifecycle (Full Status Flow)

```
pending
  → confirmed
    → awaiting_rider
      → rider_assigned
        → pickup_in_progress
          → food_collected
            → in_transit
              → delivered (Confirm Receipt button appears)
                → distribution_in_progress
                  → distributed ✅
```

Additional states: `cancelled`, `expired`, `disputed`

#### Dashboard Tabs
| Tab | Content |
|-----|---------|
| **Active Claims** | All in-progress food claims with live status |
| **History** | Completed, cancelled, expired claims |
| **Distribution Records** | Food received and distributed records |

#### NGO Actions Per Claim
| Action | When Available |
|--------|---------------|
| **Confirm Claim** | After `pending` |
| **Cancel Claim** | Before `rider_assigned` |
| **Confirm Receipt** | After `delivered` — opens Receipt Modal |
| **Mark Distribution Complete** | After confirming receipt |
| **Report Issue / Dispute** | Any active claim |
| **Chat with Rider/Donor** | Any active claim |

#### Receipt Confirmation Modal
When food is delivered by rider, NGO confirms receipt with:
- Actual quantity received (servings)
- Food condition notes (free text)
- Safety concern flag (yes/no)
- Safety concern details (if flagged)

#### Distribution Tracking
After receipt, NGO logs distribution:
- Quantity distributed
- Quantity remaining
- Distribution notes
- Number of people served

---

### 3.2 — Discover Food Page (`DiscoverPage`)

NGOs browse available food listings:
- Filter by: food type, category, distance, urgency
- Sort by: newest, closest, expiring soonest
- One-click **Claim** button with serving quantity selector
- Food card shows: photo, title, category, servings, distance, pickup time window, allergens, urgency badge

---

## 🚴 Rider / Volunteer Features

### 4.1 — Rider Dashboard (`RiderDashboardPage`)

#### Available Tasks Panel
- Shows all `awaiting_rider` delivery tasks near the rider
- Each task shows: food title, pickup & dropoff addresses, distance, servings, pickup window
- **Accept Task** button assigns the rider to the delivery

#### My Active Deliveries
Full status tracking for the rider's current assignments:

| Status | Rider Action |
|--------|-------------|
| `rider_assigned` | **Go to Pickup** button (opens navigation) |
| `going_to_pickup` | **Confirm Food Collected** button → opens Pickup Modal |
| `food_collected` | In transit — **Mark Delivered** → opens Dropoff Modal |
| `in_transit` | **Confirm Delivery** → opens Delivery Confirmation Modal |
| `delivered` | Waiting for NGO to confirm receipt |
| `completed` | Delivery done ✅ |

#### Pickup Confirmation Modal
Rider confirms food pickup with:
- **6-character verification code** from donor (prevents fraud)
- Actual servings collected (vs. expected)
- Discrepancy note (if servings differ)

#### Delivery Confirmation Modal
Rider confirms dropoff at NGO with:
- **6-character dropoff code** from NGO
- Actual servings delivered
- Delivery notes

#### Incident Reporting
If something goes wrong:
- Incident types: `food_spoiled`, `donor_unavailable`, `ngo_closed`, `vehicle_breakdown`, `other`
- Notes field
- Triggers moderation review

#### Rider Stats (Sidebar)
- Total deliveries completed
- Current streak (days active)
- Average rating
- Distance covered (km)

---

### 4.2 — Pickup Verification Code System

A **fraud-prevention system** using 6-character alphanumeric codes:
- Donor generates a code when the rider arrives
- Rider enters the code in the app to confirm food handover
- NGO generates a code for the rider to confirm delivery
- Codes are stored in `delivery_tasks` as `pickup_code` and `dropoff_code`

---

## 👨‍👩‍👧 Community / Beneficiary Features

### 5.1 — Beneficiary Dashboard (`BeneficiaryDashboardPage`)
- Browse available food listings in the community
- Find food near them on the map
- View upcoming food distribution events by NGOs
- Contact nearby NGOs for assistance
- View personal food access history

---

## 🛡️ Admin Features

### 6.1 — Admin Control Panel (`AdminPage`)

A three-tab management interface for platform administrators:

#### Tab 1 — Users Management
| Column | Description |
|--------|-------------|
| Name & Email | User identity |
| Role | donor, ngo, rider, etc. |
| City | Location |
| Verified Status | ✅ Verified / ❌ Unverified |
| Joined Date | Account creation date |
| **Verify / Unverify** | Toggle user verification status |

- Lists last 50 users sorted by newest
- One-click verify/unverify any user
- Shows role badge for each user

#### Tab 2 — Food Listings Management
| Column | Description |
|--------|-------------|
| Title | Food listing name |
| Category | Food category |
| Servings | Number of servings |
| City | Listing city |
| Status | Current listing status |
| Urgent | Urgency flag |
| Posted Date | Creation timestamp |

- Lists last 50 listings sorted by newest
- Overview of platform food activity

#### Tab 3 — System Stats
- Total registered users (by role breakdown)
- Total food listings created
- Platform health indicators

---

## 🗺️ Map & Discovery

### 7.1 — Interactive Food Map (`MapPage` + `FoodMap`)

- **Leaflet + React-Leaflet** powered interactive map
- Color-coded markers for food listing status:
  - 🟢 Green: Available
  - 🟡 Yellow: Partially Reserved
  - 🔴 Red: Urgent
  - ⚫ Grey: Expired/Completed
- Click marker → popup with food summary + Claim button
- User location dot (blue pulsing) via browser GPS
- Filter by food type or category
- Real-time listing updates

### 7.2 — Discover Page (`DiscoverPage`)

- Split view: **List + Map side by side**
- Search by food name or location
- Filters: food type, category, distance, urgency
- Sort: newest, closest, expiring soonest
- One-click claim from card or map popup

### 7.3 — Drag-and-Drop Pickup Pin (Create Donation)

- Interactive Leaflet map in the donation creation flow
- Donor drags an orange pin to set exact pickup location
- Map auto-reverse-geocodes the pin to fill in the address
- GPS auto-detect button for quick location fill

---

## 💬 Real-time Chat

### 8.1 — Chat System (`ChatPage` + `ChatService`)

#### Conversation Types
| Type | Description |
|------|-------------|
| `direct` | 1-on-1 conversation between any two users |
| `donation` | Chat linked to a specific food listing |
| `delivery` | Chat linked to a specific delivery task |

#### Message Types
| Type | Description |
|------|-------------|
| `text` | Plain text messages |
| `image` | Image attachments |
| `location` | Shared location pin |
| `system` | Auto-generated status updates (e.g., "Rider assigned") |

#### Features
- **Real-time delivery** via Supabase Realtime WebSocket subscriptions
- **Read receipts** — `isRead` flag per message
- **Unread count** badge on conversations list
- **Last message preview** in conversation list
- **Auto-link chats to deliveries** — when a rider is assigned, a delivery chat is auto-created
- **Find or Create** — `getOrCreateDirectConversation()` avoids duplicate chats

#### Chat Access Points
- From the Donor Dashboard (message rider)
- From the NGO Claims Dashboard (message donor or rider)
- From the Rider Dashboard (message NGO or donor)
- From any food card (message donor)

---

## 📊 Impact & Analytics

### 9.1 — Impact Dashboard (`ImpactDashboardPage`)

#### Community-Wide Stats
| Metric | Description |
|--------|-------------|
| 🍽️ **Meals Saved** | Total meals rescued from waste |
| ⚖️ **Food Redistributed (kg)** | Total weight of food rescued |
| 👥 **People Reached** | Unique people who received food |
| 🌱 **Waste Prevented (kg)** | Food waste prevented |
| 🌍 **CO₂ Saved (kg)** | Environmental impact calculation |
| 📦 **Donations Count** | Total food listings created |
| ✅ **Claims Count** | Total successful food claims |
| 🏢 **Active NGOs** | NGOs actively participating |
| 🏙️ **Cities Covered** | Geographic reach |
| 📅 **This Month's Meals** | Monthly impact counter |

#### Personal Impact (Donor / NGO)
- My total donations / claims
- My meals contributed
- My CO₂ saved
- Personal milestone badges

---

## 🔔 Notification System

### 10.1 — Notification Center (`NotificationsPage`)

#### Notification Types
| Type | Trigger |
|------|---------|
| `reservation_created` | NGO claimed your food listing |
| `reservation_confirmed` | Your claim was confirmed by donor |
| `pickup_ready` | Food is ready for pickup |
| `pickup_completed` | Rider has collected the food |
| `donation_created` | New food listing in your area |
| `donation_completed` | Your donation was fully claimed & delivered |
| `listing_expiring` | Your listing expires in 1 hour |
| `partner_verified` | Your partner account has been verified |
| `donation_claimed` | Your listing has a new claim |
| `system` | Platform announcements |

#### Features
- Sorted by newest first
- **Mark as Read** — single or bulk
- Unread count badge in navigation
- Clicking notification navigates to relevant page

---

## 🛡️ Content Moderation

### 11.1 — AI Image Moderation (`moderate-image` Edge Function)

A **Supabase Edge Function** (Deno runtime) that:
- Triggers when a food listing image is uploaded to Supabase Storage
- Sends the image to an AI moderation API
- If the image is flagged (inappropriate, non-food, etc.):
  - The listing is moved to `food_moderation` queue
  - Admin is notified for manual review
  - The image is removed from public view
- If the image passes, the listing goes live immediately

### 11.2 — User Reporting System

Any user can report:
- Inappropriate food listings
- Fake / spam accounts
- Suspicious activity

Reports are stored in the `reports` table and reviewed by admins.

### 11.3 — Food Moderation Queue (`food_moderation` table)

- AI-flagged listings are queued here
- Admins can: **Approve** (make listing live) or **Reject** (remove listing)
- Moderation notes attached to each decision

---

## 🔍 India NGO Discovery System

### 12.1 — NGO Discovery Page (`NGODiscoveryPage`)

A dedicated tool for finding verified NGOs across India:

#### Search & Filter
| Filter | Options |
|--------|---------|
| **Search** | Name, city, district, state |
| **Category** | Food Distribution, Child Welfare, Education, Women Empowerment, Elderly Care, Disability Support, Animal Welfare, Healthcare, Disaster Relief, Homeless Support, Environment, General Charity |
| **City / State** | Location-based filter |
| **Accepts Food Donations** | Toggle |
| **Accepts Volunteers** | Toggle |
| **Verification Status** | Filter by verification tier |
| **Sort By** | Distance, Name, Verification Level |

#### Verification Tiers (Color-coded on map)
| Tier | Color | Meaning |
|------|-------|---------|
| `source_listed` | ⚫ Grey | Listed from a public directory source |
| `contact_available` | 🟡 Amber | Contact info confirmed available |
| `sharebite_verified` | 🟢 Green | Directly verified by Sharebite team |
| `unverified` | ⚪ Light Grey | Added but not verified |

#### Map View
- Color-coded heart-shaped markers for each NGO
- Selected NGO marker scales up (animated)
- User location shown as blue pulsing dot
- `MapFlyTo` animation smoothly flies to selected NGO
- Click marker → popup with NGO details

#### List View
- Switchable between **Map view** and **List view**
- NGO cards show: logo, name, categories, address, phone, website, distance, verification badge

#### NGO Card Actions
| Action | Description |
|--------|-------------|
| **Offer Food** | Opens a food donation offer to this NGO |
| **Get Directions** | Opens Google Maps / native navigation |
| **Save NGO** | Bookmark for later |
| **Call** | Direct phone link (tel:) |
| **Website** | Opens NGO website in new tab |
| **Email** | Opens email client |

---

## 🎨 Design System & UI

### 13.1 — Design Tokens (`tokens.css`)

CSS custom properties for the entire design system:
- Color palette (primary, secondary, accent, neutrals)
- Spacing scale (4px base grid)
- Typography scale (font sizes, weights, line heights)
- Border radius values
- Shadow definitions
- Z-index layers

### 13.2 — Component Library

#### Layout Components
| Component | Purpose |
|-----------|---------|
| `AppShell` | Main authenticated layout with sidebar + content area |
| `Navbar` | Top navigation bar with notifications & avatar |
| `Sidebar` | Role-aware side navigation with active route highlights |
| `Footer` | Public page footer |
| `RoleBasedDashboard` | Smart redirector to role-specific dashboard |
| `RoleRouteGuard` | Route protection HOC |

#### Food Components
| Component | Purpose |
|-----------|---------|
| `FoodCard` | Food listing card for grids |
| `DiscoverFoodItem` | Compact listing for discover/map view |

#### Map Components
| Component | Purpose |
|-----------|---------|
| `FoodMap` | Main Leaflet map with food markers |
| `DiscoverFoodMap` | Discover page map panel |

#### State Components
| Component | Purpose |
|-----------|---------|
| `LoadingState` | Spinner + skeleton loaders |
| `EmptyState` | Empty data with illustration |
| `ErrorState` | Error display with retry option |

#### UI Primitives
| Component | Purpose |
|-----------|---------|
| `UserAvatar` | Circular avatar with fallback initials |
| `RoleCard` | Role selection card for onboarding |

### 13.3 — CSS Modules

Every component has a co-located `.module.css` file for scoped styling — no global class name conflicts.

### 13.4 — Responsive Design

- Mobile-first layouts across all pages
- Sidebar collapses on mobile
- Map views adapt to screen size
- Touch-friendly tap targets

---

## 🧪 Demo & Testing Mode

### 14.1 — Demo Users

Pre-seeded demo accounts for testing without real data:

| Role | Name | City |
|------|------|------|
| `donor` | Anubhav | Delhi |
| `ngo` | Robin Hood Army Delhi | Delhi |
| `rider` | Rahul (Rider) | Delhi |
| `admin` | Admin User | Delhi |

Each demo user has:
- Fixed UUID (from `DEMO_RECORD_UUIDS`)
- Pre-filled profile data
- Sample impact stats
- Realistic bio & organization info

### 14.2 — Demo Food Listings

5 pre-seeded demo listings across Bhopal:
- Vegetable Rice + Dal (25 servings, Malviya Nagar)
- Fresh Fruits (30 servings, MANIT Campus)
- Bread & Bakery Items (20 servings, Arera Colony) — **Urgent**
- Cooked Dal & Roti (40 servings, Piplani)
- Wedding Surplus Food (100 servings, Shahpura)

### 14.3 — Dual-Mode Architecture (Claims Service)

The `ClaimsService` runs in **dual mode**:
- **Primary:** Calls atomic PostgreSQL RPCs (when migrations are active)
- **Fallback:** Automatic client-side Supabase queries (100% uptime guarantee)

This ensures the app never breaks even if a migration hasn't been applied yet.

---

## ✅ Feature Status Summary

| Feature | Implemented | Tested | Notes |
|---------|:-----------:|:------:|-------|
| Email Auth | ✅ | ✅ | Supabase GoTrue |
| OAuth Login | ✅ | ✅ | Google + GitHub |
| Donor Registration | ✅ | ✅ | 3-step form |
| NGO Registration | ✅ | ✅ | With org details |
| Rider Registration | ✅ | ✅ | With vehicle info |
| Create Food Listing | ✅ | ✅ | 3-step wizard |
| Photo Upload + AI Moderation | ✅ | ✅ | Edge Function |
| Donor Dashboard | ✅ | ✅ | With live stats |
| Food Discover / List | ✅ | ✅ | With filters |
| NGO Claims Flow | ✅ | ✅ | Full lifecycle |
| Rider Delivery System | ✅ | ✅ | With code verify |
| Pickup Verification Code | ✅ | ✅ | 6-char codes |
| Real-time Chat | ✅ | ✅ | Supabase Realtime |
| Interactive Map | ✅ | ✅ | Leaflet |
| NGO Discovery (India) | ✅ | ✅ | 10+ categories |
| Impact Dashboard | ✅ | ✅ | Community stats |
| Notifications | ✅ | ✅ | 10 event types |
| Admin Panel | ✅ | ✅ | User + listing mgmt |
| Receipt Confirmation | ✅ | ✅ | With condition notes |
| Distribution Tracking | ✅ | ✅ | Quantity tracking |
| Incident Reporting | ✅ | ✅ | Rider can flag |
| Profile Management | ✅ | ✅ | Edit + avatar |
| Demo Mode | ✅ | ✅ | 4 demo users |
| RLS / Security | ✅ | ✅ | Per-table policies |
| Vercel Deployment | ✅ | ✅ | SPA config |

---

*Feature Report — Sharebite v1.0 | November 2026*
