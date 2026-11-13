# 📁 Sharebite — Complete Folder Structure

> Full directory tree of the Sharebite Food Rescuing App project.
> (Excludes: `node_modules/`, `.git/`, `__pycache__/`)

---

```
Sharebite food rescuing app/
│
├── 📄 index.html                          # App HTML entry point
├── 📄 package.json                        # Dependencies & npm scripts
├── 📄 package-lock.json                   # Lockfile
├── 📄 vite.config.ts                      # Vite build configuration
├── 📄 vercel.json                         # Vercel SPA deployment config
├── 📄 tsconfig.json                       # TypeScript root config
├── 📄 tsconfig.app.json                   # TypeScript app config
├── 📄 tsconfig.node.json                  # TypeScript node config
├── 📄 .oxlintrc.json                      # Linting rules (oxlint)
├── 📄 .env                                # Environment variables (not committed)
├── 📄 .env.example                        # Env variables template
├── 📄 .gitignore                          # Git ignore rules
├── 📄 LICENSE                             # Project license
├── 📄 README.md                           # Project documentation
├── 📄 ARCHITECTURE.md                     # System architecture report
├── 📄 FOLDER_STRUCTURE.md                 # This file
├── 📄 crop.ps1                            # Screenshot crop script
├── 📄 crop_auth.ps1                       # Auth screenshot crop script
├── 📄 crop_dims.ps1                       # Dimension crop script
├── 📄 crop_role_cards.ps1                 # Role card crop script
│
├── 📂 public/                             # Static public assets (served as-is)
│   ├── 📄 favicon.svg                     # App favicon
│   ├── 📄 icons.svg                       # SVG icon sprite
│   ├── 📄 robots.txt                      # SEO robots config
│   ├── 📄 sitemap.xml                     # SEO sitemap
│   └── 📄 capture_screenshots.js          # Puppeteer screenshot utility
│
├── 📂 scripts/                            # Utility & automation scripts
│
├── 📂 docs/                               # Additional documentation
│
├── 📂 design-system/                      # Design tokens & guidelines
│
├── 📂 src/                                # Main application source
│   ├── 📄 main.tsx                        # React app entry point
│   ├── 📄 App.tsx                         # Root App component & router
│   ├── 📄 App.css                         # Root app styles
│   ├── 📄 index.css                       # Base index styles
│   │
│   ├── 📂 assets/                         # Static media assets
│   │   ├── 📄 hero.png                    # Landing hero image
│   │   ├── 📄 hero_boy.jpg                # Hero section photo
│   │   ├── 📄 hero_boy_exact.png          # Processed hero image
│   │   ├── 📄 dashboard_hero_food.jpg     # Dashboard hero food photo
│   │   ├── 📄 empty_food_box.jpg          # Empty state illustration
│   │   ├── 📄 donor_chef_photo.jpg        # Donor role photo
│   │   ├── 📄 ngo_volunteers_photo.jpg    # NGO volunteers photo
│   │   ├── 📄 rider_delivery_photo.jpg    # Rider delivery photo
│   │   ├── 📄 community_member_photo.jpg  # Community member photo
│   │   ├── 📄 role_donor_illus.png        # Donor role card illustration
│   │   ├── 📄 role_acceptor_illus.png     # Acceptor role card illustration
│   │   ├── 📄 role_rider_illus.png        # Rider role card illustration
│   │   ├── 📄 auth_food_sharing.png       # Auth page food graphic
│   │   ├── 📄 auth_leaves_top_right.png   # Auth page decorative leaves
│   │   ├── 📄 auth_script_note.png        # Auth page note doodle
│   │   ├── 📄 watermark_india_gate.png    # India Gate watermark
│   │   ├── 📄 watermark_skyline.png       # Skyline watermark
│   │   ├── 📄 leaf_top_left.png           # Decorative leaf assets
│   │   ├── 📄 leaf_bottom_left.png
│   │   ├── 📄 doodle_left_heart.png       # Heart doodle assets
│   │   ├── 📄 doodle_right_note.png       # Note doodle assets
│   │   ├── 📄 react.svg                   # React logo
│   │   └── 📄 vite.svg                    # Vite logo
│   │
│   ├── 📂 components/                     # Reusable React components
│   │   │
│   │   ├── 📂 auth/                       # Authentication components
│   │   │   └── 📄 RoleCard.tsx            # Role selection card
│   │   │   └── 📄 RoleCard.module.css
│   │   │
│   │   ├── 📂 food/                       # Food listing components
│   │   │   ├── 📄 FoodCard.tsx            # Food listing card
│   │   │   ├── 📄 FoodCard.module.css
│   │   │   ├── 📄 DiscoverFoodItem.tsx    # Discover page food item
│   │   │   └── 📄 DiscoverFoodItem.module.css
│   │   │
│   │   ├── 📂 layout/                     # App layout components
│   │   │   ├── 📄 AppShell.tsx            # Main authenticated app shell
│   │   │   ├── 📄 AppShell.module.css
│   │   │   ├── 📄 Navbar.tsx              # Top navigation bar
│   │   │   ├── 📄 Navbar.module.css
│   │   │   ├── 📄 Sidebar.tsx             # Side navigation
│   │   │   ├── 📄 Sidebar.module.css
│   │   │   ├── 📄 Footer.tsx              # App footer
│   │   │   ├── 📄 Footer.module.css
│   │   │   ├── 📄 RoleBasedDashboard.tsx  # Role-aware dashboard router
│   │   │   └── 📄 RoleRouteGuard.tsx      # Auth & role route protection
│   │   │
│   │   ├── 📂 map/                        # Map components (Leaflet)
│   │   │   ├── 📄 FoodMap.tsx             # Main food map view
│   │   │   ├── 📄 DiscoverFoodMap.tsx     # Discover page map
│   │   │   └── 📄 DiscoverFoodMap.module.css
│   │   │
│   │   ├── 📂 states/                     # UI state components
│   │   │   ├── 📄 LoadingState.tsx        # Loading spinner/skeleton
│   │   │   ├── 📄 LoadingState.module.css
│   │   │   ├── 📄 EmptyState.tsx          # Empty data state
│   │   │   ├── 📄 EmptyState.module.css
│   │   │   ├── 📄 ErrorState.tsx          # Error display state
│   │   │   └── 📄 ErrorState.module.css
│   │   │
│   │   └── 📂 ui/                         # Base UI primitives
│   │       └── 📄 UserAvatar.tsx          # User avatar component
│   │
│   ├── 📂 context/                        # React Context providers
│   │   └── 📄 AuthContext.tsx             # Auth state & user context
│   │
│   ├── 📂 lib/                            # Core utilities & clients
│   │   ├── 📄 supabase.ts                 # Supabase client initialization
│   │   └── 📄 uuid.ts                     # UUID validation & demo UUIDs
│   │
│   ├── 📂 pages/                          # Route-level page components
│   │   │
│   │   ├── 📂 public/                     # Public pages (no auth required)
│   │   │   ├── 📄 LandingPage.tsx         # Home / landing page
│   │   │   ├── 📄 LandingPage.module.css
│   │   │   ├── 📄 AboutPage.tsx           # About Sharebite
│   │   │   ├── 📄 HowItWorksPage.tsx      # How it works guide
│   │   │   ├── 📄 PartnersPage.tsx        # Partners showcase
│   │   │   ├── 📄 PublicImpactPage.tsx    # Public impact stats
│   │   │   └── 📄 SimplePublicPage.module.css
│   │   │
│   │   ├── 📂 auth/                       # Authentication pages
│   │   │   ├── 📄 LoginPage.tsx           # Login form
│   │   │   ├── 📄 SignupPage.tsx          # Email signup
│   │   │   ├── 📄 ForgotPasswordPage.tsx  # Password reset request
│   │   │   ├── 📄 ResetPasswordPage.tsx   # New password form
│   │   │   ├── 📄 AuthCallbackPage.tsx    # OAuth callback handler
│   │   │   ├── 📄 RoleSelectPage.tsx      # Choose your role
│   │   │   ├── 📄 RoleSelect.module.css
│   │   │   ├── 📄 RoleAuthPage.tsx        # Role-specific auth
│   │   │   ├── 📄 RoleAuth.module.css
│   │   │   ├── 📄 SingleRoleAuthPage.tsx  # Single role auth flow
│   │   │   ├── 📄 DonorRegisterPage.tsx   # Donor registration form
│   │   │   ├── 📄 DonorRegister.module.css
│   │   │   ├── 📄 AcceptorRegisterPage.tsx # NGO/Acceptor registration
│   │   │   ├── 📄 AcceptorRegister.module.css
│   │   │   ├── 📄 RiderRegisterPage.tsx   # Rider registration form
│   │   │   ├── 📄 RiderRegister.module.css
│   │   │   └── 📄 AuthPage.module.css     # Shared auth page styles
│   │   │
│   │   └── 📂 app/                        # Authenticated app pages
│   │       ├── 📄 DonorDashboardPage.tsx  # Donor main dashboard
│   │       ├── 📄 DonorDashboardPage.module.css
│   │       ├── 📄 DonorDonationsStatus.tsx # Donor donation history
│   │       ├── 📄 DonorDonationsStatus.module.css
│   │       ├── 📄 CreateDonationPage.tsx  # Create new food listing
│   │       ├── 📄 CreateDonationPage.module.css
│   │       ├── 📄 DonationDetailPage.tsx  # Donation detail view
│   │       ├── 📄 DonationDetailPage.module.css
│   │       ├── 📄 DonationsPage.tsx       # All donations list
│   │       ├── 📄 NGOClaimsDashboard.tsx  # NGO claims management
│   │       ├── 📄 NGOClaimsDashboard.module.css
│   │       ├── 📄 NGODiscoveryPage.tsx    # India NGO discovery map
│   │       ├── 📄 NGODiscoveryPage.module.css
│   │       ├── 📄 RiderDashboardPage.tsx  # Rider delivery dashboard
│   │       ├── 📄 RiderDashboard.module.css
│   │       ├── 📄 BeneficiaryDashboardPage.tsx # Community dashboard
│   │       ├── 📄 DiscoverPage.tsx        # Discover food listings
│   │       ├── 📄 DiscoverPage.module.css
│   │       ├── 📄 MapPage.tsx             # Interactive map view
│   │       ├── 📄 MapPage.module.css
│   │       ├── 📄 ChatPage.tsx            # In-app messaging
│   │       ├── 📄 ChatPage.module.css
│   │       ├── 📄 ImpactDashboardPage.tsx # Impact stats dashboard
│   │       ├── 📄 ImpactDashboardPage.module.css
│   │       ├── 📄 NotificationsPage.tsx   # Notification center
│   │       ├── 📄 NotificationsPage.module.css
│   │       ├── 📄 ProfilePage.tsx         # User profile editor
│   │       ├── 📄 ProfilePage.module.css
│   │       ├── 📄 RequestsPage.tsx        # Food requests
│   │       ├── 📄 RequestsPage.module.css
│   │       ├── 📄 SettingsPage.tsx        # Account settings
│   │       ├── 📄 SettingsPage.module.css
│   │       ├── 📄 VerificationPage.tsx    # Account verification
│   │       ├── 📄 VerificationPage.module.css
│   │       ├── 📄 DashboardPage.tsx       # Generic dashboard
│   │       ├── 📄 DashboardPage.module.css
│   │       ├── 📄 AdminPage.tsx           # Admin control panel
│   │       ├── 📄 AdminPage.module.css
│   │       └── 📄 AppPage.module.css      # Shared app page styles
│   │
│   ├── 📂 services/                       # Supabase query service layer
│   │   ├── 📄 auth.ts                     # Auth, login, signup, demo users
│   │   ├── 📄 donations.ts                # Food listing CRUD operations
│   │   ├── 📄 claims.ts                   # Reservation management
│   │   ├── 📄 chat.ts                     # Messaging & conversations
│   │   ├── 📄 impact.ts                   # Impact stats queries
│   │   ├── 📄 location.ts                 # Geolocation & nearby search
│   │   ├── 📄 ngo.ts                      # NGO profile operations
│   │   ├── 📄 ngoDiscovery.ts             # India NGO directory
│   │   ├── 📄 notifications.ts            # Notification queries
│   │   └── 📄 partners.ts                 # Partner organization queries
│   │
│   ├── 📂 styles/                         # Global styles
│   │   ├── 📄 global.css                  # Global base styles
│   │   ├── 📄 tokens.css                  # CSS design tokens (colors, spacing)
│   │   └── 📄 leaflet-fix.css             # Leaflet map CSS overrides
│   │
│   └── 📂 types/                          # TypeScript type definitions
│       └── 📄 index.ts                    # All shared types & interfaces
│
└── 📂 supabase/                           # Supabase backend config & DB
    ├── 📄 complete_schema.sql             # ⭐ Canonical full DB schema (run this)
    ├── 📄 migration.sql                   # Base schema migration v1
    ├── 📄 rider_delivery_migration.sql    # Rider & delivery tables
    ├── 📄 moderation_migration.sql        # Content moderation tables
    ├── 📄 chat_and_realtime_migration.sql # Real-time chat tables
    ├── 📄 ngo_discovery_migration.sql     # India NGO discovery system
    ├── 📄 phase2_14_migration.sql         # Phase 2 extended features
    ├── 📄 god_mode_migration.sql          # Admin god-mode tables
    ├── 📄 profiles_rls_fix.sql            # RLS policy fixes
    ├── 📄 web_fixes_migration.sql         # Web-specific patches
    │
    └── 📂 functions/                      # Supabase Edge Functions (Deno)
        ├── 📄 deno.json                   # Deno config
        ├── 📄 tsconfig.json               # TS config for edge functions
        └── 📂 moderate-image/             # AI image moderation function
            └── 📄 index.ts                # Image moderation logic
```

---

## 📊 Stats

| Metric | Count |
|--------|-------|
| **Total Files** | ~646 files |
| **Source Files (.tsx/.ts)** | ~90+ files |
| **Style Files (.css)** | ~40+ files |
| **SQL Migration Files** | 10 files |
| **Edge Functions** | 1 (moderate-image) |
| **Total Lines of Code** | ~83,900+ |

---

## 🗂️ Key Files Quick Reference

| File | Purpose |
|------|---------|
| `src/main.tsx` | React entry — renders `<App/>` |
| `src/App.tsx` | Router setup — all route definitions |
| `src/lib/supabase.ts` | Supabase client (used everywhere) |
| `src/context/AuthContext.tsx` | Global auth state provider |
| `src/types/index.ts` | All TypeScript interfaces & enums |
| `supabase/complete_schema.sql` | Run this to set up the full database |
| `vite.config.ts` | Build config with manual chunking |
| `vercel.json` | Vercel SPA rewrite rules |
| `.env.example` | Copy → `.env` and fill in Supabase keys |

---

*Generated: November 2026 | Sharebite v1.0*
