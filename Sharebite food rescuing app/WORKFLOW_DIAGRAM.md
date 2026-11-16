# 🔄 Sharebite — Complete Working Flow & Architecture Diagrams

> Comprehensive visual workflows, state machines, sequence diagrams, and lifecycle specifications for the Sharebite Food Rescuing Platform.

---

## 📋 Table of Contents

1. [High-Level End-to-End Ecosystem Flow](#-1-high-level-end-to-end-ecosystem-flow)
2. [Stakeholder Swimlane Workflow](#-2-stakeholder-swimlane-workflow)
3. [Sequence Diagram: Listing & AI Moderation](#-3-sequence-diagram-food-listing--ai-moderation)
4. [Sequence Diagram: Claiming & Concurrency Locking](#-4-sequence-diagram-ngo-claiming--concurrency-lock)
5. [Sequence Diagram: Dispatch, Live GPS & Handover PIN](#-5-sequence-diagram-dispatch-tracking--handover-pin)
6. [Sequence Diagram: Receipt & Community Distribution](#-6-sequence-diagram-receipt--community-distribution)
7. [Food Listing State Machine](#-7-food-listing-state-machine)
8. [NGO Claim & Delivery Lifecycle State Machine](#-8-ngo-claim--delivery-lifecycle-state-machine)
9. [Exception Handling & Incident Workflows](#-9-exception-handling--incident-workflows)

---

## 🌐 1. High-Level End-to-End Ecosystem Flow

```mermaid
flowchart TD
    classDef donor fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef edge fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px;
    classDef ngo fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef rider fill:#ffedd5,stroke:#ea580c,stroke-width:2px;
    classDef db fill:#f1f5f9,stroke:#475569,stroke-width:2px;

    D1["🏪 Donor Prepares Surplus Food"]:::donor --> D2["📱 Fill 3-Step Donation Form<br/>(Servings, Expiry, Map Pin, Photo)"]:::donor
    D2 --> E1["⚡ Deno Edge Function<br/>(AI Food Image Moderation)"]:::edge

    E1 -- "Invalid/Duplicate/Spam" --> E2["❌ Flagged for Admin Review<br/>(User Prompted for New Photo)"]:::edge
    E1 -- "Verified Food Photo" --> DB1[("🗄️ PostgreSQL Database<br/>status: 'available'")]:::db

    DB1 --> N1["🏢 Nearby NGOs Receive Realtime Alert<br/>(Haversine Distance RPC)"]:::ngo
    N1 --> N2{"NGO Reserves Servings"}:::ngo

    N2 --> DB2[("🔒 Transaction Lock<br/>reserve_food() RPC")]:::db
    DB2 --> T1["📦 Delivery Task Spawned<br/>status: 'awaiting_rider'"]:::db

    T1 --> R1["🚴 Nearby Riders See Task in Fleet Hub"]:::rider
    R1 --> R2["Accept Task & Start Route"]:::rider

    R2 --> R3["📍 Rider Arrives at Donor<br/>(Enters 6-Char Pickup PIN)"]:::rider
    R3 --> DB3[("🗄️ Database Updates<br/>status: 'food_collected'")]:::db

    DB3 --> R4["🚴 In Transit with Live GPS Broadcast"]:::rider
    R4 --> N3["🏢 NGO Inspects & Enters Dropoff PIN"]:::ngo

    N3 --> DB4[("✅ Delivery Complete<br/>status: 'delivered'")]:::db
    DB4 --> N4["🍲 NGO Distributes to Beneficiaries<br/>(Logs Quantity & Headcount)"]:::ngo
    N4 --> IMP["📈 Realtime Environmental & Social Impact Updated<br/>(CO₂e, Water, Meals Saved)"]:::db
```

---

## 🏊 2. Stakeholder Swimlane Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Donor as 🏪 Food Donor
    participant Web as 💻 Sharebite Web Client
    participant Edge as ⚡ Deno Edge AI
    participant DB as 🗄️ Supabase PostgreSQL
    actor NGO as 🏢 Verified NGO
    actor Rider as 🚴 Delivery Rider

    Note over Donor,Rider: PHASE 1: LISTING CREATION & VALIDATION
    Donor->>Web: Input food details, shelf-life & photo
    Web->>Edge: POST /functions/v1/moderate-image
    Edge->>Edge: Check SHA-256 hash & ViT model
    Edge-->>Web: Verdict: Approved (is_food: true)
    Web->>DB: INSERT into food_listings (status: 'available')
    DB-->>Web: Broadcast via Realtime WebSocket

    Note over Donor,Rider: PHASE 2: SPATIAL DISCOVERY & CLAIM
    NGO->>Web: Open Discover Map / nearby_ngos() RPC
    Web->>DB: Call reserve_food(listing_id, servings)
    DB->>DB: SELECT FOR UPDATE (atomic lock)
    DB->>DB: Decrement available_servings & create reservation
    DB->>DB: Create delivery_task (status: 'awaiting_rider')
    DB-->>NGO: Claim Confirmed!

    Note over Donor,Rider: PHASE 3: DISPATCH & SECURE HANDOVER
    Rider->>Web: Accept task via assign_rider_to_delivery()
    Web->>DB: Set status: 'RIDER_ASSIGNED', rider_id
    Rider->>Donor: Arrive at pickup location
    Donor->>Rider: Provide 6-char Pickup Code
    Rider->>Web: Submit Code to confirmPickup()
    Web->>DB: Set status: 'FOOD_COLLECTED'

    Note over Donor,Rider: PHASE 4: IN-TRANSIT & DROPOFF
    loop Every 5 Seconds
        Rider->>DB: Broadcast GPS location update
        DB-->>Web: Live map marker position updated
    end
    Rider->>NGO: Deliver food at shelter / community center
    NGO->>Rider: Provide 6-char Dropoff Code
    Rider->>Web: Submit Code to confirmDelivery()
    Web->>DB: Set status: 'DELIVERED'

    Note over Donor,Rider: PHASE 5: DISTRIBUTION & IMPACT AUDIT
    NGO->>Web: Confirm receipt condition & log beneficiaries served
    Web->>DB: INSERT into impact_events
    DB->>DB: Increment mealsSaved, co2SavedKg & foodRedistributedKg
    DB-->>Web: Realtime dashboard update
```

---

## 🔍 3. Sequence Diagram: Food Listing & AI Moderation

Detailed workflow of how donor contributions are screened for safety, authenticity, and non-duplicate verification before becoming public:

```mermaid
sequenceDiagram
    actor Donor
    participant UI as CreateDonationPage
    participant Storage as Supabase Storage (S3)
    participant Edge as Deno Edge Function
    participant HF as HuggingFace Vision API
    participant DB as Supabase PostgreSQL

    Donor->>UI: Select photo & fill dietary specifics
    UI->>Storage: Upload raw image binary
    Storage-->>UI: Return public CDN imageUrl
    UI->>Edge: POST /functions/v1/moderate-image { imageUrl, userId }

    critical Image Integrity Verification
        Edge->>Edge: Validate Magic Bytes (JPEG/PNG/WebP)
        Edge->>Edge: Compute SHA-256 Hash
        Edge->>DB: Check food_moderation for duplicate hash
    end

    alt Duplicate Hash Found
        Edge-->>UI: Reject: "Duplicate photo detected"
        UI-->>Donor: Prompt to capture fresh picture
    else Unique Hash
        par Parallel Inference
            Edge->>HF: Query nateraw/food (Food Classifier)
            Edge->>HF: Query vit-base-patch16-224 (General Classifier)
        end
        HF-->>Edge: Return classification tags & confidence scores
        Edge->>Edge: Decision Engine: Quality & Food Confidence >= 0.25
        Edge->>DB: INSERT into food_moderation (audit log)
        Edge-->>UI: Decision: APPROVED
    end

    UI->>DB: INSERT into food_listings
    DB-->>UI: Success (Listing Active & Searchable)
```

---

## 🔒 4. Sequence Diagram: NGO Claiming & Concurrency Lock

How Sharebite prevents **race conditions** and double-claims when hundreds of NGOs search the same metropolitan area:

```mermaid
sequenceDiagram
    actor NGO1 as 🏢 NGO A (Wants 30 Servings)
    actor NGO2 as 🏢 NGO B (Wants 25 Servings)
    participant RPC as PostgreSQL reserve_food()
    participant Table as food_listings Table (50 Servings Total)
    participant Res as reservations Table

    par Simultaneous Claim Requests
        NGO1->>RPC: reserve_food(listing_id, servings: 30)
        NGO2->>RPC: reserve_food(listing_id, servings: 25)
    end

    Note over RPC,Table: DATABASE LOCKING PHASE
    RPC->>Table: SELECT * FROM food_listings WHERE id = $1 FOR UPDATE

    rect rgb(240, 253, 244)
        Note over RPC,Table: NGO A acquires row-lock first
        Table-->>RPC: Row state: available_servings = 50
        RPC->>RPC: Check 30 <= 50 (Valid!)
        RPC->>Res: INSERT INTO reservations (servings: 30)
        RPC->>Table: UPDATE available_servings = 20, status = 'partially_reserved'
        RPC-->>NGO1: Reservation Confirmed (id: res_1)
    end

    rect rgb(254, 242, 242)
        Note over RPC,Table: NGO B lock released & evaluated
        Table-->>RPC: Row state: available_servings = 20
        RPC->>RPC: Check 25 <= 20 (False: Insufficient Servings!)
        RPC-->>NGO2: Exception: "Only 20 servings available. Requested: 25"
    end
```

---

## 🚴 5. Sequence Diagram: Dispatch, Tracking & Handover PIN

Security handshake ensuring food is handed to the authorized rider and verified upon arrival:

```mermaid
sequenceDiagram
    actor Donor as 🏪 Donor
    actor Rider as 🚴 Rider
    participant App as Rider Dashboard
    participant DB as Supabase DB
    actor NGO as 🏢 NGO

    Note over Donor,NGO: Step 1: Rider Acceptance
    Rider->>App: Click 'Accept Delivery'
    App->>DB: assign_rider_to_delivery(taskId, riderId)
    DB-->>App: Status: RIDER_ASSIGNED
    DB-->>Donor: Alert: Rider Kabir is on the way!

    Note over Donor,NGO: Step 2: Pickup Verification Handshake
    Rider->>Donor: Arrive at Donor Location
    Donor->>Donor: Check App for 6-Character Pickup Code (e.g. "SB-8924")
    Donor->>Rider: Verbally communicate "SB-8924"
    Rider->>App: Input Pickup Code "SB-8924"
    App->>DB: confirmPickup(taskId, code: "SB-8924")
    alt Code Matches DB
        DB-->>App: Status -> 'FOOD_COLLECTED'
        DB-->>NGO: Alert: Food collected and in transit!
    else Code Mismatch
        DB-->>App: Error: Invalid Verification Code
    end

    Note over Donor,NGO: Step 3: Realtime Location Broadcast
    loop While in transit
        Rider->>App: Geolocation WatchPosition
        App->>DB: INSERT into rider_location_updates
        DB-->>NGO: Leaflet Map updates Rider Marker in real-time
    end

    Note over Donor,NGO: Step 4: Dropoff Verification Handshake
    Rider->>NGO: Arrive at NGO Destination
    NGO->>NGO: Check App for Dropoff Code (e.g. "SB-3190")
    NGO->>Rider: Provide "SB-3190"
    Rider->>App: Input Dropoff Code "SB-3190"
    App->>DB: confirmDelivery(taskId, code: "SB-3190")
    DB-->>App: Status -> 'DELIVERED'
```

---

## 🍲 6. Sequence Diagram: Receipt & Community Distribution

```mermaid
sequenceDiagram
    actor NGO as 🏢 NGO Worker
    participant Web as NGO Claims Dashboard
    participant DB as PostgreSQL Database
    participant Impact as Public Impact Hub

    NGO->>Web: Click 'Confirm Food Receipt'
    Web->>Web: Open Receipt Confirmation Modal
    NGO->>Web: Enter quantity received, food condition notes, and safety flag
    Web->>DB: confirmNgoReceipt(taskId, quantity, conditionNotes, isSafe)
    DB->>DB: Create distribution_record

    Note over NGO,Impact: Community Food Distribution
    NGO->>NGO: Distribute cooked meals to 120 beneficiaries
    NGO->>Web: Click 'Log Distribution' (Enter people served: 120, status: 'distributed')
    Web->>DB: Update distribution_record & INSERT into impact_events

    par Aggregate Metrics Computation
        DB->>Impact: +120 Meals Saved
        DB->>Impact: +42.0 kg Food Waste Diverted
        DB->>Impact: +105.0 kg CO₂e Prevented
        DB->>Impact: +42,000 Litres Virtual Water Conserved
    end

    Impact-->>Web: Live Leaderboards & Public Impact Updated
```

---

## 🏷️ 7. Food Listing State Machine

Lifecycle transitions of a food donation listing:

```mermaid
stateDiagram-v2
    [*] --> available: Listing Published by Donor

    available --> partially_reserved: Portion Claimed (available_servings > 0)
    available --> reserved: Full Claim (available_servings == 0)
    available --> expired: Current Time > available_until
    available --> cancelled: Donor Cancels Listing

    partially_reserved --> reserved: Remaining Servings Claimed
    partially_reserved --> picked_up: Rider Collects Partial Batch
    partially_reserved --> expired: Remaining Servings Expired

    reserved --> picked_up: Rider Inputs Donor Handover PIN
    reserved --> cancelled: Donor/NGO Aborts with Reason

    picked_up --> completed: Delivered & Confirmed by NGO

    completed --> [*]
    expired --> [*]
    cancelled --> [*]
```

---

## 📦 8. NGO Claim & Delivery Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: NGO Reserves Food Batch
    pending --> confirmed: Donor Approves Claim
    pending --> cancelled: Cancelled Prior to Dispatch

    confirmed --> awaiting_rider: Ready for Logistics Pickup
    awaiting_rider --> rider_assigned: Rider Accepts Task
    awaiting_rider --> cancelled: Timeout / Expired

    rider_assigned --> going_to_pickup: Rider En Route to Donor
    going_to_pickup --> food_collected: Handover PIN Verified
    going_to_pickup --> incident: Rider Vehicle Breakdown / No-Show

    food_collected --> in_transit: En Route to NGO / Shelter
    in_transit --> delivered: Dropoff PIN Verified at NGO
    in_transit --> incident: Transit Accident / Food Damage

    delivered --> distribution_in_progress: NGO Begins Community Serving
    distribution_in_progress --> distributed: All Meals Handed to Beneficiaries

    distributed --> [*]
    incident --> disputed: Escalated to Admin Panel
```

---

## 🚨 9. Exception Handling & Incident Workflows

```mermaid
flowchart TD
    classDef err fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    classDef fix fill:#ecfdf5,stroke:#10b981,stroke-width:2px;
    classDef adm fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;

    INC["⚠️ Incident Encountered During Delivery"]:::err --> TYPE{"What happened?"}

    TYPE -- "Food Spoiled or Quality Issue" --> I1["Rider/NGO flags 'food_spoiled'"]:::err
    TYPE -- "Donor Not Responding / Closed" --> I2["Rider flags 'donor_unavailable'"]:::err
    TYPE -- "Vehicle Breakdown" --> I3["Rider flags 'vehicle_breakdown'"]:::err

    I1 --> Q1["Task Marked as 'incident' & Frozen"]:::err
    I2 --> Q1
    I3 --> Q2["System re-dispatches to nearby online riders"]:::fix

    Q1 --> ADM["🛡️ Admin Receives Immediate Escalation in God-Mode Panel"]:::adm
    ADM --> ADM_DEC{"Admin Resolution"}:::adm

    ADM_DEC -- "Cancel & Audit Donor" --> RES1["Listing revoked, donor profile flagged"]:::err
    ADM_DEC -- "Re-route to Alternate Shelter" --> RES2["Assigned to nearest community center"]:::fix
```

---

*Sharebite Flow Specifications — Version 1.0 | November 2026*
