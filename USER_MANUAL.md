# 📖 Sharebite — Complete User & Operational Manual (SOP)

> End-to-end Standard Operating Procedures (SOP), role-specific walkthroughs, safety checklists, and troubleshooting workflows for Donors, Volunteer Riders, NGOs/Shelters, and System Administrators.

---

## 📋 Table of Contents

1. [Introduction & Platform Overview](#-1-introduction--platform-overview)
2. [Donor Operator Manual (Hotels, Restaurants & Caterers)](#-2-donor-operator-manual-hotels-restaurants--caterers)
   - 2.1 [Account Onboarding & Kitchen Profile](#21-account-onboarding--kitchen-profile)
   - 2.2 [Step-by-Step Food Listing Guide](#22-step-by-step-food-listing-guide)
   - 2.3 [Dietary Badging & Allergen Declarations](#23-dietary-badging--allergen-declarations)
   - 2.4 [Packaging & Temperature Protocol](#24-packaging--temperature-protocol)
   - 2.5 [Handoff & PIN Verification Protocol](#25-handoff--pin-verification-protocol)
   - 2.6 [Downloading Tax Exemption (80G) & ESG Certificates](#26-downloading-tax-exemption-80g--esg-certificates)
3. [Volunteer Rider Manual (Food Rescue Couriers)](#-3-volunteer-rider-manual-food-rescue-couriers)
   - 3.1 [Rider Onboarding & Vehicle Profile](#31-rider-onboarding--vehicle-profile)
   - 3.2 [Browsing & Claiming Rescue Runs](#32-browsing--claiming-rescue-runs)
   - 3.3 [Pickup Verification & Hygiene Checklist](#33-pickup-verification--hygiene-checklist)
   - 3.4 [Transit Safety & Cold-Chain Preservation](#34-transit-safety--cold-chain-preservation)
   - 3.5 [Shelter Handover & 6-Digit PIN Exchange](#35-shelter-handover--6-digit-pin-exchange)
   - 3.6 [Offline Mode & Network Drop Procedures](#36-offline-mode--network-drop-procedures)
4. [NGO & Shelter Manual (Community Recipients)](#-4-ngo--shelter-manual-community-recipients)
   - 4.1 [Shelter Verification & Beneficiary Capacity](#41-shelter-verification--beneficiary-capacity)
   - 4.2 [Setting Radius Alerts & Auto-Claim Rules](#42-setting-radius-alerts--auto-claim-rules)
   - 4.3 [Organoleptic Food Inspection (Smell / Sight / Heat Check)](#43-organoleptic-food-inspection-smell--sight--heat-check)
   - 4.4 [Handover PIN Confirmation](#44-handover-pin-confirmation)
   - 4.5 [Distribution Logging & Impact Auditing](#45-distribution-logging--impact-auditing)
5. [Platform Administrator Manual](#-5-platform-administrator-manual)
   - 5.1 [Live Mission Command Center](#51-live-mission-command-center)
   - 5.2 [AI Image Moderation & Flagged Content Resolution](#52-ai-image-moderation--flagged-content-resolution)
   - 5.3 [Dispute Resolution & Account Strikes](#53-dispute-resolution--account-strikes)
   - 5.4 [City-Wide ESG & BRSR Report Generation](#54-city-wide-esg--brsr-report-generation)
6. [Emergency & Incident Protocols (SOP-911)](#-6-emergency--incident-protocols-sop-911)
7. [Progressive Web App (PWA) Mobile Setup Guide](#-7-progressive-web-app-pwa-mobile-setup-guide)
8. [Frequently Asked Questions (FAQ) by Role](#-8-frequently-asked-questions-faq-by-role)

---

## 🌟 1. Introduction & Platform Overview

Sharebite is a mission-critical food rescue network connecting commercial surplus food generators (hotels, banquets, restaurants, cloud kitchens) with verified grassroots shelters, orphanages, and community kitchens via volunteer couriers.

### The Four Pillars of Sharebite Operations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SHAREBITE CORE LIFECYCLE                          │
└──────┬──────────────────────┬──────────────────────┬────────────────────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  1. DONOR    │       │   2. RIDER   │       │   3. NGO     │
│  Lists food  │──────▶│ Transits run │──────▶│ Verifies &   │
│  within 2 hrs│       │ safe & quick │       │ consumes via │
│  of cooking  │       │ in insul bag │       │ 6-digit PIN  │
└──────────────┘       └──────────────┘       └──────────────┘
       ▲                      ▲                      ▲
       └──────────────────────┼──────────────────────┘
                              │
                       ┌──────────────┐
                       │   4. ADMIN   │
                       │ AI Moderates │
                       │ Audits & CSR │
                       └──────────────┘
```

---

## 🏨 2. Donor Operator Manual (Hotels, Restaurants & Caterers)

### 2.1 Account Onboarding & Kitchen Profile
1. **Sign Up**: Navigate to `/register` and choose **"Food Donor / Commercial Partner"**.
2. **Business Details**:
   - Legal Business Name & Trade Name (e.g., *Grand Hyatt Banquet Operations*).
   - Physical Kitchen Address with accurate Google Maps pin drop.
   - FSSAI License Number (14-digit registration; optional for home donors, mandatory for commercial entities).
   - Emergency Kitchen Contact (Head Chef or F&B Manager mobile number).
3. **Operating Hours**: Specify default kitchen dispatch windows (e.g., Lunch wrap-up: 15:30–16:30; Dinner wrap-up: 23:00–00:30).

---

### 2.2 Step-by-Step Food Listing Guide

```
Step 1: Dashboard ➡️ Click "+ Create Food Listing"
Step 2: Upload Real-Time Photo (AI Scan validates visual quality)
Step 3: Select Food Category & Serving Size
Step 4: Tag Dietary Constraints (Veg / Jain / Halal)
Step 5: Set Cooked Time & Expiry Deadline (FSSAI 2-hr rule)
Step 6: Specify Storage Temperature & Packaging Type
Step 7: Confirm Pickup Address & Publish Listing
```

#### Detailed Field Specifications:

| Form Field | Allowed Values | FSSAI Guideline / Operational Rule |
|:---|:---|:---|
| **Title** | Text (e.g., *"Paneer Butter Masala & Steamed Basmati Rice"*)| Be specific; avoid generic titles like *"Leftover food"*. |
| **Category** | Cooked Meals, Bakery/Dry Goods, Raw Produce, Dairy/Packaged | Cooked meals receive highest courier dispatch priority. |
| **Servings Count** | Integer (e.g., `45` meals) or Weight in Kg (`18` kg) | 1 Standard Adult Meal ≈ 350g to 450g cooked weight. |
| **Preparation Time** | Timestamp (within past 3 hours) | Cooked food exceeding 4 hours without refrigeration is rejected. |
| **Expiry Countdown** | Automatic or custom (Default: 4 hours from prep) | System automatically de-lists item when timer hits zero. |
| **Storage Status** | Hot Holding (>65°C), Refrigerated (<4°C), Ambient | Crucial for the courier to select the appropriate delivery container. |

---

### 2.3 Dietary Badging & Allergen Declarations
To ensure dignified and religiously observant distribution, every listing must carry precise badges:

- 🟢 **Pure Vegetarian (Green Circle in Green Square)**: Zero meat, fish, poultry, or egg content. Contains dairy.
- 🟡 **Jain Compliant**: Pure vegetarian + strictly NO root vegetables (no onions, garlic, potatoes, carrots, or radishes).
- 🔴 **Non-Vegetarian (Brown Triangle in Brown Square)**: Contains poultry, mutton, or fish. Must specify halal certification status where applicable.
- 🌾 **Allergen Alert Checkboxes**: Flag common allergens: `Contains Gluten`, `Contains Peanuts/Nuts`, `Contains Dairy/Lactose`, `Contains Soy`.

---

### 2.4 Packaging & Temperature Protocol

> [!IMPORTANT]
> Sharebite adheres to the **FSSAI Food Safety and Standards (Recovery of Surplus Food) Regulations, 2019**. Never donate food that has been touched or left on guest buffet plates. Only untouched batch surplus from kitchen preparation pans or unserved chafing dishes is acceptable.

1. **Approved Containers**:
   - Food-grade tamper-evident plastic containers.
   - Aluminum foil trays with crimped paper/foil lids.
   - Stainless steel milk cans / sealed drums for gravies and dals (returned to donor within 24 hours).
2. **Labeling**:
   - Write the Sharebite **Listing ID** (e.g., `#SB-8921`) and **Preparation Time** directly onto container lids with a permanent marker.
3. **Temperature Preservation**:
   - **Hot Food**: Maintain at $>60^\circ\text{C}$ in insulated thermal boxes until the volunteer rider arrives.
   - **Cold/Salad Items**: Maintain chilled at $<5^\circ\text{C}$ in walk-in cold rooms.

---

### 2.5 Handoff & PIN Verification Protocol
1. When the assigned volunteer rider arrives, verify their **Rider Name** and **Vehicle Registration Number** against your live dashboard.
2. Hand over the sealed food containers.
3. **Do NOT share any secret PIN**: The 6-digit verification PIN belongs to the **receiving NGO**, not the donor. Once the rider inspects the seals, mark **"Handed to Courier"** on your dashboard.

---

### 2.6 Downloading Tax Exemption (80G) & ESG Certificates
At the conclusion of each calendar month:
1. Navigate to **Dashboard ➡️ Impact & Tax Exemption**.
2. Click **"Download Consolidated 80G Receipt"** (Generated in partnership with accredited recipient NGOs, permitting corporate tax deductions under the Income Tax Act, 1961).
3. Click **"Export BRSR ESG Carbon Audit"** (SEBI-compliant PDF/CSV detailing metric tons of diverted organic waste and CO₂e emissions prevented).

---

## 🛵 3. Volunteer Rider Manual (Food Rescue Couriers)

### 3.1 Rider Onboarding & Vehicle Profile
1. **Registration**: Select **"Volunteer Courier / Rescue Rider"**.
2. **Vehicle Declaration**:
   - 🚴 **Bicycle / Walking**: Max radius 2.5 km | Max cargo 8 kg.
   - 🛵 **Two-Wheeler (Motorcycle / EV Scooter)**: Max radius 12 km | Max cargo 25 kg (Requires insulated carrier bag).
   - 🚗 **Four-Wheeler / Electric Van**: Max radius 30 km | Bulk catering rescues (25 kg to 300 kg).
3. **Kit Verification**: Upload a photo of your insulated delivery bag (Sharebite branded or standard delivery kit with thermal foil lining).

---

### 3.2 Browsing & Claiming Rescue Runs

```
Interactive Map ➡️ Filter by "Immediate Dispatch" ➡️ Review Distance & Weight ➡️ Swipe "Accept Rescue Mission"
```

1. Open the **"Active Missions"** tab on your smartphone.
2. Review the mission card:
   - **Donor Name & Distance** (e.g., *Hotel Radisson Blu — 2.4 km*).
   - **NGO Destination** (e.g., *Asha Sadan Children Home — 4.1 km*).
   - **Item Breakdown** (e.g., *30 Servings Veg Pulao, 10 Litres Dal*).
   - **Safe Transit Window** (e.g., *Deliver before 17:15 — 38 mins remaining*).
3. Tap **"Accept Rescue Mission"**: The platform automatically engages an atomic mutex database lock to guarantee you alone own this route.

---

### 3.3 Pickup Verification & Hygiene Checklist
Upon arrival at the donor's kitchen:
- [ ] Inspect container seals: Ensure no loose lids, oil leaks, or tears.
- [ ] Visual steam/temperature check: Ensure hot food is warm to the touch.
- [ ] Confirm item count matches the app manifest (e.g., 3 large foil boxes).
- [ ] Tap **"Confirm Pickup & Start Navigation"** in the app.

---

### 3.4 Transit Safety & Cold-Chain Preservation
- Secure containers upright in the insulated thermal bag to avoid spillage.
- Keep the thermal bag zippered shut during transit to prevent heat loss or dust exposure.
- Follow in-app GPS routing; do not make unscheduled detours while carrying temperature-sensitive cooked food.

---

### 3.5 Shelter Handover & 6-Digit PIN Exchange

> [!CAUTION]
> The atomic completion of every rescue mission is cryptographically locked behind a **6-Digit Dynamic Handshake PIN**. Never leave food at a shelter doorstep without entering this PIN.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       6-DIGIT PIN HANDSHAKE PROTOCOL                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Rider arrives at Shelter gate.                                           │
│ 2. Shelter Supervisor inspects the containers (smell & temperature check).  │
│ 3. Supervisor reads aloud the 6-Digit PIN displayed on their Shelter App.   │
│ 4. Rider types the 6 digits into their Rider Screen.                        │
│ 5. Database executes atomic stored procedure `verify_pickup_pin()`.          │
│ 6. Status updates to `DELIVERED`, and impact points are credited instantly! │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Offline Mode & Network Drop Procedures
If cellular connectivity drops in low-signal basement kitchens or remote shelter locations:
1. The Sharebite PWA automatically caches the mission state in your phone's **IndexedDB**.
2. Input the NGO's PIN as normal: The app validates the SHA-256 hash locally.
3. As soon as your device regains internet connection, the background sync worker flushes the timestamped completion event to the Supabase master cluster.

---

## 🏢 4. NGO & Shelter Manual (Community Recipients)

### 4.1 Shelter Verification & Beneficiary Capacity
To maintain platform integrity and prevent commercial black-marketing of donated meals:
1. Upload NGO Trust Deed / Society Registration Certificate / Section 12A & 80G Approval.
2. Enter **Darpan Portal ID** (for Indian non-profits registered on NITI Aayog Darpan).
3. Specify your daily beneficiary head-count (e.g., *65 resident children*, *120 elderly inmates*, *300 community kitchen capacity*).
4. Specify dietary constraints (e.g., *Strictly Pure Veg & Jain Only*).

---

### 4.2 Setting Radius Alerts & Auto-Claim Rules
To get first access to nearby surplus listings:
- **Set Alert Radius**: Define your delivery acceptance boundary (e.g., $5\text{ km}$ or $10\text{ km}$).
- **Push & WhatsApp Notifications**: Enable instant real-time drop notifications so your kitchen staff can prepare plates ahead of courier arrival.
- **Auto-Decline Criteria**: Configure items your shelter cannot accept (e.g., non-vegetarian food or unsealed bakery goods).

---

### 4.3 Organoleptic Food Inspection (Smell / Sight / Heat Check)
Before revealing the PIN to the courier, the NGO Kitchen Supervisor must perform a mandatory 30-second **Organoleptic Quality Assessment**:

| Inspection Step | Pass Criteria | Fail Criteria (Reject & Cancel) |
|:---|:---|:---|
| **Aroma / Smell** | Fresh, pleasant, characteristic cooked spices. | Sour, fermented, stale, acidic, or rancid odor. |
| **Visual Appearance**| Normal color, no bubbling or froth on gravy surface. | Slimy texture, visible discoloration, unusual bubbles. |
| **Physical Temperature**| Cooked gravies warm/hot ($>55^\circ\text{C}$) or chilled. | Lukewarm gravy ($25^\circ\text{C} - 40^\circ\text{C}$) kept >4 hours. |
| **Container Integrity**| Lids crimped, sealed, no road grit or external water. | Broken lids, spillage, wet cartons, punctured foil. |

---

### 4.4 Handover PIN Confirmation
1. If the food passes the organoleptic test, open your **Shelter Dashboard**.
2. Locate the active delivery card and reveal the **6-Digit Verification PIN** (e.g., `4 8 2 9 1 0`).
3. Verbally communicate this code to the courier. Once the courier submits it, the transaction is permanently archived.

---

### 4.5 Distribution Logging & Impact Auditing
1. Within 2 hours of consumption, upload 1–2 photographs of the meal distribution.
2. Confirm the number of individuals served (e.g., *55 children fed dinner*).
3. Your shelter profile builds an immutable **Public Transparency Index**, unlocking corporate donor grants and kitchen equipment subsidies.

---

## 🛡️ 5. Platform Administrator Manual

### 5.1 Live Mission Command Center
Admins monitor real-time platform operations via `/admin/dashboard`:
- **Real-Time Heartbeat**: Active listings count, unassigned rescue missions, couriers in transit, and total kilograms rescued today.
- **SLA Breach Watchdog**: Listings with less than 45 minutes until expiry that remain unaccepted are highlighted in pulsing red, triggering automated broadcast alerts to nearby Tier-1 couriers.

---

### 5.2 AI Image Moderation & Flagged Content Resolution
Every food photograph uploaded by donors is analyzed asynchronously by the Deno Edge Vision Worker:
1. **Automated AI Scan**: Inspects image for NSFW violations, non-food stock photography, and deceptive pictures.
2. **Flagged Queue (`/admin/moderation`)**:
   - If AI confidence falls below 85%, the listing is temporarily gated.
   - Admin can **"Approve Listing"** or **"Reject with Reason"** (e.g., *"Photograph does not show actual prepared food items"*).

---

### 5.3 Dispute Resolution & Account Strikes
To enforce community standards, Sharebite operates a **3-Strike Safety Policy**:
- **Strike 1 (Warning)**: Minor packaging leak or delayed handoff (>20 mins after courier arrival).
- **Strike 2 (Temporary 7-Day Suspension)**: Donating food that fails organoleptic shelter inspection.
- **Strike 3 (Permanent Blacklisting)**: Intentional donation of spoiled food, false PIN entry attempts, or abusive behavior toward couriers.

---

### 5.4 City-Wide ESG & BRSR Report Generation
Platform administrators can generate comprehensive regional compliance reports for municipal authorities and corporate partners:
- **Metrics Calculated**: Total Meals Rescued, Landfill Organic Mass Diverted (Tons), Methane Emissions Avoided ($\text{kg CH}_4$), Net Carbon Offsets ($\text{tCO}_2\text{e}$), and Virtual Water Saved (Million Litres).
- Export formats: **BRSR Core PDF**, **SEBI XBRL-ready CSV**, and **Raw Supabase JSON Dump**.

---

## 🚨 6. Emergency & Incident Protocols (SOP-911)

### Incident 1: Food Quality Rejection at Shelter Gate
1. **Immediate Quarantine**: Do not distribute any portion of the rejected food.
2. **App Incident Report**: The shelter manager taps **"Report Quality Failure"** on the delivery screen.
3. **Photo Evidence**: Upload close-up photos of the discolored or bubbling food.
4. **Safe Disposal**: The food is directed to local municipal composting or livestock fodder bio-bins; it is never fed to humans.
5. **Auto Investigation**: The donor account is automatically restricted until the Quality Assurance lead contacts the executive chef.

### Incident 2: Courier Breakdown or Accident Mid-Transit
1. The courier taps **"Emergency / Roadside Assist"** on their active delivery screen.
2. The system splits the mission into an **Emergency Relay**:
   - Geofence triggers an urgent ping to the nearest two active riders within a 1.5 km radius.
   - Secondary rider intercepts, scans the package QR code, and completes the remaining leg of the transit.

### Incident 3: Lost PIN or Disconnected Phone at Shelter
1. If the shelter manager’s phone battery dies or internet is down:
2. The courier and shelter supervisor call the **24x7 Sharebite Toll-Free Dispatch Hotline**.
3. Dispatch confirms shelter supervisor identity via registered Aadhaar/OTP and executes an **Admin Override Handshake**, closing the run safely.

---

## 📱 7. Progressive Web App (PWA) Mobile Setup Guide

Sharebite is built as a zero-friction, lightning-fast Progressive Web App (PWA) that installs directly on smartphones without requiring 100MB Play Store downloads:

### For Android Users (Chrome / Brave / Edge)
1. Open Chrome and visit `https://sharebite.app` (or your local domain).
2. Look for the bottom banner: **"Add Sharebite to Home screen"**.
3. Tap **Install**: The app icon will appear alongside your native apps.
4. Go to **Phone Settings ➡️ Apps ➡️ Sharebite ➡️ Permissions**: Enable **Location** ("While using app") and **Notifications**.

### For iOS / Apple iPhone Users (Safari)
1. Open **Safari** and navigate to `https://sharebite.app`.
2. Tap the **Share Icon** (the square with an upward arrow at the bottom of the screen).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top-right corner.
5. Open the newly added Sharebite icon from your Home Screen.

---

## ❓ 8. Frequently Asked Questions (FAQ) by Role

### 🏨 Donors
**Q: Can we donate half-eaten or customer-returned food?**  
*A: Absolutely not. Under FSSAI regulations, only untouched batch surplus preserved in kitchen prep trays or unserved chafing pans is legally acceptable.*

**Q: Are we liable if someone gets ill after eating donated food?**  
*A: No. Under the Indian Good Samaritan provisions and FSSAI Section 87 guidelines, bona fide food donors acting in good faith without negligence are fully protected from civil and criminal liability.*

---

### 🛵 Volunteer Couriers
**Q: Do I get paid for delivery runs?**  
*A: Sharebite operates on a hybrid model: Community runs earn volunteer certificates, college credits, and CSR reward points. Commercial B2B sponsored catering runs provide fuel allowances (₹40–₹80 per run) credited directly to your UPI ID.*

**Q: What if the donor takes more than 20 minutes to hand over the food?**  
*A: You can tap "Donor Delay Alert" in your app. If the wait exceeds 20 minutes without communication, you may cancel the mission without any penalty to your rider reliability rating.*

---

### 🏢 NGOs & Shelters
**Q: Is there any cost for shelters to receive food?**  
*A: Zero. 100% of rescued food and logistics routing is completely free of charge for accredited grassroots shelters and orphanages.*

**Q: Can we request specific food types (e.g., milk for infants or diabetic diets)?**  
*A: Yes. You can specify preferred categories in your shelter profile preferences; the system prioritizes relevant drops to your shelter first.*

---

*Sharebite Operational Manual v2.4 • Maintained by Sharebite Core Operations Team • FSSAI & DPDP Compliant*