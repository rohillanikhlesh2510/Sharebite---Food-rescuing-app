# 🔄 Sharebite — Complete Working Flow & Lifecycle Diagrams

> **Visual Workflow Specifications, State Machines, Sequence Diagrams, and Event Lifecycles**  
> Covers End-to-End Rescue Lifecycles, Concurrency Mutex Handshakes, Edge AI Moderation, 6-Digit Verification PIN Protocols, and Incident Failover Procedures.

---

## 📋 Table of Contents

1. [High-Level End-to-End Ecosystem Flow](#-1-high-level-end-to-end-ecosystem-flow)
2. [Four-Party Stakeholder Swimlane Workflow](#-2-four-party-stakeholder-swimlane-workflow)
3. [Sequence Diagram: Food Listing & Edge AI Vision Moderation](#-3-sequence-diagram-food-listing--edge-ai-vision-moderation)
4. [Sequence Diagram: NGO Claiming & Concurrency Row-Locking](#-4-sequence-diagram-ngo-claiming--concurrency-row-locking)
5. [Sequence Diagram: Logistics Dispatch & 6-Digit PIN Handshake](#-5-sequence-diagram-logistics-dispatch--6-digit-pin-handshake)
6. [Sequence Diagram: Community Distribution & Impact Calculation](#-6-sequence-diagram-community-distribution--impact-calculation)
7. [Food Listing Lifecycle State Machine](#-7-food-listing-lifecycle-state-machine)
8. [NGO Reservation & Delivery Lifecycle State Machine](#-8-ngo-reservation--delivery-lifecycle-state-machine)
9. [Offline-First Rider Cache & Sync Workflow](#-9-offline-first-rider-cache--sync-workflow)
10. [FSSAI Organoleptic Food Inspection Flow](#-10-fssai-organoleptic-food-inspection-flow)
11. [Exception Handling & Incident Escalation (SOP-911)](#-11-exception-handling--incident-escalation-sop-911)

---

## 🌐 1. High-Level End-to-End Ecosystem Flow

```mermaid
flowchart TD
    classDef donor fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef edge fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px;
    classDef ngo fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef rider fill:#ffedd5,stroke:#ea580c,stroke-width:2px;
    classDef db fill:#f1f5f9,stroke:#475569,stroke-width:2px;

    D1["🏨 Commercial Donor Prepares Surplus Batch"]:::donor --> D2["📱 Fill Listing Form\n(Servings, Expiry, Map Pin, Photo)"]:::donor
    D2 --> E1["⚡ Deno Edge Function\n(AI Food Vision Moderation)"]:::edge

    E1 -- "Invalid / Non-Food / Spam" --> E2["❌ Flagged to Admin Review\n(User Prompted for New Photo)"]:::edge
    E1 -- "Verified Food Photo" --> DB1[("🐘 PostgreSQL Database\nstatus: 'available'")]:::db

    DB1 --> N1["🏢 Nearby NGOs Receive Realtime CDC Alert\n(Haversine Distance Match)"]:::ngo
    N1 --> N2{"NGO Reserves Servings"}:::ngo

    N2 --> DB2[("🔒 Transaction Lock\nclaim_food_atomic() RPC")]:::db
    DB2 --> T1["📦 Delivery Task Created\nstatus: 'awaiting_rider'"]:::db

    T1 --> R1["🛵 Volunteer Couriers See Mission on Radar"]:::rider
    R1 --> R2["Accept Task & Route to Donor"]:::rider

    R2 --> R3["📍 Rider Arrives at Kitchen\n(Inspects Container Packaging)"]:::rider
    R3 --> DB3[("🐘 Database Updates\nstatus: 'food_collected'")]:::db

    DB3 --> R4["🛵 In-Transit with Live GPS Broadcast"]:::rider
    R4 --> N3["🍲 NGO Inspects & Reveals 6-Digit PIN"]:::ngo

    N3 --> DB4[("✅ Delivery Complete\nverify_pickup_pin() RPC")]:::db
    DB4 --> N4["👥 NGO Distributes to Beneficiaries\n(Logs Headcount & Photos)"]:::ngo
    N4 --> IMP["📈 Realtime Environmental & Social Impact Updated\n(CO₂e Avoided, Water Conserved, Meals Saved)"]:::db
```

---

## 🏊 2. Four-Party Stakeholder Swimlane Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Donor as 🏨 Food Donor
    participant Web as 💻 Sharebite Web Client
    participant Edge as ⚡ Deno Edge AI
    participant DB as 🐘 Supabase PostgreSQL
    actor NGO as 🏢 Verified NGO
    actor Rider as 🛵 Volunteer Rider

    Note over Donor,Rider: STAGE 1: BATCH CREATION & QUALITY MODERATION
    Donor->>Web: Input surplus batch details, expiry & photo
    Web->>Edge: POST /functions/v1/moderate-image
    Edge->>Edge: Validate magic bytes, SHA-256 & ViT classifier
    Edge-->>Web: Verdict: Approved (Confidence: 94%)
    Web->>DB: INSERT into food_listings (status: 'available')
    DB-->>Web: Broadcast Realtime CDC Event (Postgres WAL)

    Note over Donor,Rider: STAGE 2: GEOSPATIAL MATCH & CONCURRENT CLAIM
    NGO->>Web: Open Discover Map (nearby_ngos() RPC)
    Web->>DB: Call claim_food_atomic(listing_id, servings)
    DB->>DB: SELECT FOR UPDATE (atomic mutex lock)
    DB->>DB: Decrement available_servings & insert reservation
    DB->>DB: Create delivery task (status: 'awaiting_rider')
    DB-->>NGO: Reservation Confirmed!

    Note over Donor,Rider: STAGE 3: LOGISTICS DISPATCH & PICKUP
    Rider->>Web: Accept run via assign_rider_to_delivery()
    Web->>DB: Set status: 'rider_assigned', rider_id
    Rider->>Donor: Arrive at dispatch kitchen
    Donor->>Rider: Hand over sealed containers (Lids crimped)
    Rider->>Web: Tap "Confirm Pickup & Start Navigation"
    Web->>DB: Set status: 'food_collected'

    Note over Donor,Rider: STAGE 4: IN-TRANSIT & PIN HANDSHAKE
    loop Every 5 Seconds in Transit
        Rider->>DB: Broadcast GPS coordinate update
        DB-->>NGO: Live Leaflet marker updates position
    end
    Rider->>NGO: Arrive at shelter gate
    NGO->>NGO: Conduct 30-sec organoleptic check (Smell & Heat)
    NGO->>Rider: Read aloud 6-Digit PIN (e.g. 849-210)
    Rider->>Web: Submit PIN to verify_pickup_pin()
    Web->>DB: Validate hash & set status: 'delivered'

    Note over Donor,Rider: STAGE 5: COMMUNITY CONSUMPTION & IMPACT
    NGO->>Web: Confirm beneficiaries fed (e.g. 75 children)
    Web->>DB: INSERT into impact_events
    DB->>DB: Auto-increment mealsSaved, co2SavedKg & virtualWaterL
    DB-->>Web: Realtime dashboard & 80G tax receipt updated
```

---

## 🔍 3. Sequence Diagram: Food Listing & Edge AI Vision Moderation

```mermaid
sequenceDiagram
    actor Donor as 🏨 Donor Chef
    participant UI as 💻 CreateDonationPage
    participant Storage as 📦 Supabase Storage (S3)
    participant Edge as ⚡ Deno Edge Function
    participant VisionAI as 🤖 Vision Transformer API
    participant DB as 🐘 Supabase PostgreSQL

    Donor->>UI: Select photo & fill dietary specifics
    UI->>Storage: Upload raw image binary to 'food-images'
    Storage-->>UI: Return public CDN imageUrl
    UI->>Edge: POST /functions/v1/moderate-image { imageUrl, userId }

    critical Image Integrity Verification
        Edge->>Edge: Validate Magic Bytes (JPEG/PNG/WebP)
        Edge->>Edge: Compute SHA-256 Checksum
        Edge->>DB: Check food_moderation for duplicate hash
    end

    alt Duplicate Hash Found
        Edge-->>UI: Reject: "Duplicate photo detected from past listing"
        UI-->>Donor: Prompt to capture fresh kitchen picture
    else Unique Hash
        par Parallel Safety & Classification Inference
            Edge->>VisionAI: Food Classifier (nateraw/food)
            Edge->>VisionAI: Safety Classifier (vit-base-safety)
        end
        VisionAI-->>Edge: Return classification tags & confidence scores
        Edge->>Edge: Decision Matrix: Food Confidence >= 85% & Safe
        Edge->>DB: INSERT into food_moderation (audit log)
        Edge-->>UI: Decision: APPROVED
    end

    UI->>DB: INSERT into food_listings (status: 'available')
    DB-->>UI: Success: Listing Active & Broadcasted
```

---

## 🔒 4. Sequence Diagram: NGO Claiming & Concurrency Row-Locking

How Sharebite prevents **race conditions** and double-allocation when multiple NGOs simultaneously claim the same surplus batch during peak evening hours:

```mermaid
sequenceDiagram
    actor NGO1 as 🏢 Shelter A (Wants 30 Servings)
    actor NGO2 as 🏢 Shelter B (Wants 25 Servings)
    participant RPC as ⚡ claim_food_atomic() RPC
    participant Table as 🐘 food_listings (50 Servings Total)
    participant Res as 📋 reservations Table

    par Simultaneous Concurrent Requests
        NGO1->>RPC: claim_food_atomic(listing_id, servings: 30)
        NGO2->>RPC: claim_food_atomic(listing_id, servings: 25)
    end

    Note over RPC,Table: ATOMIC MUTEX LOCKING PHASE
    RPC->>Table: SELECT servings FROM food_listings WHERE id = $1 FOR UPDATE

    rect rgb(240, 253, 244)
        Note over RPC,Table: Shelter A acquires row mutex lock first
        Table-->>RPC: Row state: available_servings = 50
        RPC->>RPC: Validate 30 <= 50 (Valid)
        RPC->>Res: INSERT INTO reservations (servings: 30, status: 'confirmed')
        RPC->>Table: UPDATE servings = 20, status = 'partially_reserved'
        RPC-->>NGO1: Reservation Confirmed (id: res_1, remaining: 20)
    end

    rect rgb(254, 242, 242)
        Note over RPC,Table: Shelter B mutex lock acquired next
        Table-->>RPC: Row state: available_servings = 20
        RPC->>RPC: Check 25 <= 20 (Invalid: Insufficient Servings!)
        RPC-->>NGO2: Error: "Only 20 servings available. Requested: 25"
    end
```

---

## 🛵 5. Sequence Diagram: Logistics Dispatch & 6-Digit PIN Handshake

```mermaid
sequenceDiagram
    actor Donor as 🏨 Donor
    actor Rider as 🛵 Volunteer Rider
    participant App as 📱 Rider Mobile PWA
    participant DB as 🐘 Supabase Database
    actor NGO as 🏢 Shelter Supervisor

    Note over Donor,NGO: Step 1: Rider Acceptance
    Rider->>App: Tap 'Accept Rescue Mission'
    App->>DB: RPC: assign_rider_to_delivery(taskId, riderId)
    DB-->>App: Status: 'rider_assigned'
    DB-->>Donor: Notification: Courier Kabir is on the way!

    Note over Donor,NGO: Step 2: Kitchen Pickup
    Rider->>Donor: Arrive at Donor Kitchen
    Donor->>Rider: Hand over sealed thermal packages
    Rider->>App: Verify container count & tap 'Confirm Pickup'
    App->>DB: Status -> 'food_collected'
    DB-->>NGO: Alert: Food collected and in transit!

    Note over Donor,NGO: Step 3: Realtime Location Streaming
    loop While in transit (Every 5 seconds)
        Rider->>App: Geolocation watchPosition()
        App->>DB: INSERT into rider_location_updates
        DB-->>NGO: Live Leaflet marker updates position
    end

    Note over Donor,NGO: Step 4: Dropoff 6-Digit PIN Handshake
    Rider->>NGO: Arrive at shelter gate
    NGO->>NGO: Perform 30-sec organoleptic smell & heat check
    NGO->>NGO: Open Shelter App ➡️ Reveals 6-Digit PIN (e.g. 582-914)
    NGO->>Rider: Verbally communicates "582-914"
    Rider->>App: Type PIN into keypad
    App->>DB: RPC: verify_pickup_pin(delivery_id, "582914")
    alt PIN Matches Hash
        DB-->>App: Status -> 'delivered' (Success sound + vibration)
        DB-->>NGO: Status -> 'delivered' (Stock added)
    else PIN Mismatch
        DB-->>App: Error: Invalid PIN (Attempt 1 of 3)
    end
```

---

## 🍲 6. Sequence Diagram: Community Distribution & Impact Calculation

```mermaid
sequenceDiagram
    actor NGO as 🏢 Shelter Supervisor
    participant Web as 💻 NGO Claims Dashboard
    participant DB as 🐘 PostgreSQL Database
    participant Impact as 📊 Public Impact Engine

    NGO->>Web: Click 'Confirm Meal Distribution'
    Web->>Web: Open Distribution Modal
    NGO->>Web: Enter people fed (120), upload photo, and rate quality (5/5)
    Web->>DB: INSERT into impact_events & update reservation status

    par Scientific Impact Formula Computation
        DB->>Impact: +120 Meals Saved
        DB->>Impact: +42.0 kg Organic Food Diverted (120 * 0.35kg)
        DB->>Impact: +105.0 kg CO₂e Prevented (42.0kg * 2.5)
        DB->>Impact: +42,000 Litres Virtual Water Conserved (42.0kg * 1,000L)
    end

    Impact-->>Web: Live Leaderboards & SEBI BRSR Impact Updated
```

---

## 🏷️ 7. Food Listing Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> available: Published by Donor (AI Approved)

    available --> partially_reserved: Portion Claimed (remaining_servings > 0)
    available --> reserved: 100% Claimed (remaining_servings == 0)
    available --> expired: Current Time > available_until
    available --> cancelled: Donor Withdraws Listing

    partially_reserved --> reserved: Remaining Servings Claimed
    partially_reserved --> picked_up: Rider Collects Partial Batch
    partially_reserved --> expired: Remaining Servings Expire

    reserved --> picked_up: Rider Confirms Kitchen Pickup
    reserved --> cancelled: Aborted with Reason Prior to Pickup

    picked_up --> completed: Delivered via 6-Digit PIN Handshake

    completed --> [*]
    expired --> [*]
    cancelled --> [*]
```

---

## 📦 8. NGO Reservation & Delivery Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: NGO Reserves Food Batch
    pending --> confirmed: Atomic Mutex Verified
    pending --> cancelled: Cancelled Prior to Dispatch

    confirmed --> awaiting_rider: Ready for Courier Assignment
    awaiting_rider --> rider_assigned: Volunteer Couriers Accepts Run
    awaiting_rider --> cancelled: Batch Expired Without Rider

    rider_assigned --> going_to_pickup: Rider Navigating to Kitchen
    going_to_pickup --> food_collected: Kitchen Handoff Verified
    going_to_pickup --> incident: Vehicle Breakdown / Rider No-Show

    food_collected --> in_transit: En Route to Receiving Shelter
    in_transit --> delivered: 6-Digit PIN Handshake Verified
    in_transit --> incident: Transit Accident / Thermal Loss

    delivered --> distribution_in_progress: NGO Begins Community Serving
    distribution_in_progress --> distributed: Meals Served & Photos Logged

    distributed --> [*]
    incident --> disputed: Escalated to Admin God-Mode Panel
```

---

## 📱 9. Offline-First Rider Cache & Sync Workflow

```mermaid
flowchart TD
    Online{"Network Status"} -->|Connected| DirectPost["Direct PostgREST API Call\n(Sub-50ms Supabase RPC)"]
    Online -->|Offline / Basement| CacheLocal["Write Event to IndexedDB Queue\n('offline_sync_queue')"]

    CacheLocal --> HashCheck{"PIN Validation?"}
    HashCheck -->|Yes| LocalHash["Validate SHA-256 PIN Hash Locally\n(Show Offline Success Banner)"]
    HashCheck -->|No| LocalStore["Persist Mutation Payload"]

    NetworkRecover["Device Regains 4G/5G Network"] --> ServiceWorker["Background Service Worker Triggers"]
    ServiceWorker --> FlushQueue["FIFO Queue Playback\nFlush Cached Mutations to Supabase"]
    FlushQueue --> SyncComplete["Server Acknowledges Mutations\nLocal Queue Cleared"]
```

---

## 🌡️ 10. FSSAI Organoleptic Food Inspection Flow

```mermaid
flowchart TD
    Arrival["Courier Arrives at Shelter Gate"] --> Aroma{"Aroma Inspection\nCharacteristic fresh food odor?"}
    Aroma -- "Sour / Fermented / Rancid" --> Fail["❌ REJECT BATCH\nTap 'Report Food Failure'\nDivert to Composting Bio-Bin"]
    Aroma -- "Fresh & Pleasant" --> Visual{"Visual Inspection\nFroth, bubbles or slime?"}

    Visual -- "Bubbling / Discolored" --> Fail
    Visual -- "Normal Uniform Gravy" --> Temp{"Temperature Check\nHot (>55°C) or Cold (<5°C)?"}

    Temp -- "Lukewarm held > 4 hours" --> Fail
    Temp -- "Safe Temperature Confirmed" --> Pass["✅ PASS INSPECTION\nReveal 6-Digit Handshake PIN\nAccept Delivery & Feed Beneficiaries"]
```

---

## 🚨 11. Exception Handling & Incident Escalation (SOP-911)

```mermaid
flowchart TD
    classDef err fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    classDef fix fill:#ecfdf5,stroke:#10b981,stroke-width:2px;
    classDef adm fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;

    INC["⚠️ Incident Reported During Mission"]:::err --> TYPE{"Incident Category"}

    TYPE -- "Food Spoiled at Inspection" --> I1["Shelter flags 'food_spoiled'"]:::err
    TYPE -- "Donor Kitchen Unresponsive" --> I2["Rider flags 'donor_unavailable'"]:::err
    TYPE -- "Courier Roadside Breakdown" --> I3["Rider flags 'vehicle_breakdown'"]:::err

    I1 --> Q1["Delivery Frozen & Audit Lock Engaged"]:::err
    I2 --> Q1
    I3 --> Q2["Emergency Relay: Re-broadcast to nearest 2 riders within 1.5 km"]:::fix

    Q1 --> ADM["🛡️ Immediate Escalation in Admin Panel (/admin)"]:::adm
    ADM --> ADM_DEC{"Administrator Decision"}:::adm

    ADM_DEC -- "Cancel & Audit Donor" --> RES1["Listing revoked, donor profile given Strike 1"]:::err
    ADM_DEC -- "Re-route Batch" --> RES2["Assigned to alternative verified community shelter"]:::fix
```

---

*Sharebite Visual Flow Specifications v2.4 • Maintained by Sharebite Engineering Core Team*