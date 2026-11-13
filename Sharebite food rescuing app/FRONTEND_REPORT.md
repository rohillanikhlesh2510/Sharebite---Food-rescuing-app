# ⚛️ Sharebite — Complete Frontend Report

> Deep-dive technical documentation of the entire frontend system — React architecture, routing, state management, components, design system, performance optimizations, and patterns.

---

## 📋 Table of Contents

1. [Frontend Overview](#-frontend-overview)
2. [Tech Stack & Versions](#-tech-stack--versions)
3. [Application Entry & Bootstrap](#-application-entry--bootstrap)
4. [Routing Architecture](#-routing-architecture)
5. [State Management](#-state-management)
6. [AuthContext — Global Auth State](#-authcontext--global-auth-state)
7. [Component Architecture](#-component-architecture)
8. [Pages Reference](#-pages-reference)
9. [Design System & Tokens](#-design-system--tokens)
10. [Performance Optimizations](#-performance-optimizations)
11. [Build System (Vite)](#-build-system-vite)
12. [Utility Library (`lib/`)](#-utility-library-lib)
13. [TypeScript Type System](#-typescript-type-system)
14. [CSS Architecture](#-css-architecture)
15. [Frontend Security Patterns](#-frontend-security-patterns)
16. [Data Flow Patterns](#-data-flow-patterns)

---

## 🏛️ Frontend Overview

Sharebite's frontend is a **React 19 Single Page Application (SPA)** built with Vite and TypeScript. It follows a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (SPA)                        │
│                                                         │
│  index.html → main.tsx → <App />                        │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  QueryClientProvider (TanStack React Query)    │     │
│  │  ┌──────────────────────────────────────────┐  │     │
│  │  │  AuthProvider (React Context)            │  │     │
│  │  │  ┌────────────────────────────────────┐  │  │     │
│  │  │  │  BrowserRouter (React Router v7)   │  │  │     │
│  │  │  │  ┌──────────────────────────────┐  │  │  │     │
│  │  │  │  │  AppRoutes (Route Tree)       │  │  │  │     │
│  │  │  │  │  ┌────────────────────────┐  │  │  │  │     │
│  │  │  │  │  │  AppShell (Layout)     │  │  │  │  │     │
│  │  │  │  │  │  ┌──────────────────┐  │  │  │  │  │     │
│  │  │  │  │  │  │  Page Components │  │  │  │  │  │     │
│  │  │  │  │  │  └──────────────────┘  │  │  │  │  │     │
│  │  │  │  │  └────────────────────────┘  │  │  │  │     │
│  │  │  │  └──────────────────────────────┘  │  │  │     │
│  │  │  └────────────────────────────────────┘  │  │     │
│  │  └──────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack & Versions

| Package | Version | Role |
|---------|---------|------|
| `react` | ^19.2.8 | UI framework |
| `react-dom` | ^19.2.8 | DOM renderer |
| `typescript` | ~6.0.2 | Static typing |
| `vite` | ^8.3.0 | Build tool & dev server |
| `@vitejs/plugin-react` | ^6.1.1 | Vite React plugin (SWC) |
| `react-router-dom` | ^7.18.3 | Client-side routing |
| `@tanstack/react-query` | ^5.102.8 | Server state & caching |
| `@supabase/supabase-js` | ^2.116.0 | Backend client |
| `leaflet` | ^1.9.4 | Interactive maps |
| `react-leaflet` | ^5.0.0 | React Leaflet bindings |
| `lucide-react` | ^1.46.0 | Icon library |
| `date-fns` | ^4.4.0 | Date formatting |
| `oxlint` | ^1.81.0 | Fast Rust-based linter |
| `puppeteer-core` | ^25.16.0 | Screenshot automation (dev) |

---

## 🚀 Application Entry & Bootstrap

### `index.html` → `main.tsx` → `App.tsx`

```
index.html
  └── <div id="root">
        └── main.tsx
              └── ReactDOM.createRoot(root).render(
                    <StrictMode>
                      <App />
                    </StrictMode>
                  )
```

### `main.tsx`
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- **React.StrictMode** enabled in development — double-renders to surface side effects
- **createRoot** (React 18+ concurrent mode API)

### `App.tsx` — Provider Tree
```
<QueryClientProvider client={queryClient}>    ← Server state
  <AuthProvider>                              ← Auth global state
    <BrowserRouter>                           ← Routing
      <AppRoutes />                           ← Route definitions
    </BrowserRouter>
  </AuthProvider>
</QueryClientProvider>
```

### TanStack Query Configuration
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,  // 2 min cache before refetch
      retry: 1,                   // Retry failed queries once
    },
  },
});
```

---

## 🗺️ Routing Architecture

React Router DOM v7 with **full code-split lazy loading**.

### Strategy: Eager + Lazy Loading
- **LandingPage** → Eager import (instant LCP, no layout shift)
- **All other pages** → `React.lazy()` + `<Suspense>` (code split, only loaded on demand)

### Route Guard Components

#### `ProtectedRoute`
Wraps all authenticated pages. If not logged in → redirects to `/register`.
```tsx
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <Navigate to="/register" replace />;
  return <>{children}</>;
}
```

#### `PublicOnlyRoute`
Wraps auth pages. If already logged in → redirects to role dashboard.
```tsx
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoading />;
  if (user) return <Navigate to={getRoleDashboardPath(user.role)} replace />;
  return <>{children}</>;
}
```

#### `RoleRouteGuard`
Wraps role-specific pages. Checks user role against `allowedRoles[]`.
```tsx
<RoleRouteGuard allowedRoles={['donor', 'partner', 'admin']} fallbackPath="/dashboard">
  <DonorDashboardPage />
</RoleRouteGuard>
```

#### `RootRoute`
Smart root handler — detects OAuth callback tokens in URL hash:
```tsx
function RootRoute() {
  const location = useLocation();
  if (location.hash.includes('access_token=') || location.search.includes('code=')) {
    return <Navigate to={`/auth/callback${location.search}${location.hash}`} replace />;
  }
  return <LandingPage />;
}
```

### Complete Route Table

| Path | Component | Guard | Allowed Roles |
|------|-----------|-------|--------------|
| `/` | LandingPage | Public | All |
| `/about` | AboutPage | Public | All |
| `/how-it-works` | HowItWorksPage | Public | All |
| `/impact` | PublicImpactPage | Public | All |
| `/partners` | PartnersPage | Public | All |
| `/register` | RoleSelectPage | PublicOnly | Unauthenticated |
| `/register/donor` | DonorRegisterPage | PublicOnly | — |
| `/register/acceptor` | AcceptorRegisterPage | PublicOnly | — |
| `/register/ngo` | AcceptorRegisterPage | PublicOnly | — |
| `/register/rider` | RiderRegisterPage | PublicOnly | — |
| `/register/community` | SingleRoleAuthPage | PublicOnly | — |
| `/register/:role` | SingleRoleAuthPage | PublicOnly | — |
| `/login/donor` | DonorRegisterPage (login mode) | PublicOnly | — |
| `/login/acceptor` | AcceptorRegisterPage (login) | PublicOnly | — |
| `/login/rider` | RiderRegisterPage (login) | PublicOnly | — |
| `/auth/callback` | AuthCallbackPage | — | — |
| `/forgot-password` | ForgotPasswordPage | PublicOnly | — |
| `/reset-password` | ResetPasswordPage | — | — |
| `/dashboard` | RoleBasedDashboard | Protected | Any auth |
| `/donor-dashboard` | DonorDashboardPage | Protected + Role | donor, partner, admin |
| `/donations/new` | CreateDonationPage | Protected + Role | donor, partner, admin |
| `/donations/:id/edit` | CreateDonationPage | Protected + Role | donor, partner, admin |
| `/donor-donations` | DonorDonationsStatus | Protected + Role | donor, partner, admin |
| `/donations` | DonationsPage | Protected | Any auth |
| `/donations/:id` | DonationDetailPage | Protected | Any auth |
| `/rider-dashboard` | RiderDashboardPage | Protected + Role | rider, volunteer, admin |
| `/ngo-dashboard` | NGOClaimsDashboard | Protected + Role | ngo, receiver, acceptor, admin |
| `/my-claims` | NGOClaimsDashboard | Protected + Role | ngo, receiver, acceptor, admin |
| `/community-dashboard` | BeneficiaryDashboardPage | Protected + Role | community, receiver, admin |
| `/discover` | DiscoverPage | Protected | Any auth |
| `/map` | MapPage | Protected | Any auth |
| `/requests` | RequestsPage | Protected | Any auth |
| `/notifications` | NotificationsPage | Protected | Any auth |
| `/impact-dashboard` | ImpactDashboardPage | Protected | Any auth |
| `/profile` | ProfilePage | Protected | Any auth |
| `/settings` | SettingsPage | Protected | Any auth |
| `/verification` | VerificationPage | Protected | Any auth |
| `/admin` | AdminPage | Protected + Role | admin only |
| `/chat` | ChatPage | Protected | Any auth |
| `/chat/:conversationId` | ChatPage | Protected | Any auth |
| `/ngos` | NGODiscoveryPage | Protected | Any auth |
| `*` | Redirect → `/` | — | — |

---

## 🗂️ State Management

Sharebite uses a **hybrid state management** approach:

| State Type | Solution | Why |
|-----------|---------|-----|
| **Server state** (API data) | TanStack React Query | Caching, background refetch, stale-while-revalidate |
| **Auth state** (user session) | React Context (`AuthContext`) | Global, accessed everywhere |
| **UI state** (modals, tabs, loading) | Local `useState` per component | Simple, co-located |
| **Form state** | Local `useState` | Controlled inputs |
| **URL state** | React Router `useParams`, `useSearchParams` | Shareable, bookmarkable |

---

## 🔐 AuthContext — Global Auth State

**File:** `src/context/AuthContext.tsx`

The single source of truth for authentication. Every component accesses it via `useAuth()`.

### Context Interface
```ts
interface AuthContextType {
  user: User | null;         // Current user (null = not logged in)
  loading: boolean;          // Auth state being resolved
  login(email, password?, expectedRole?) → Promise<User>
  loginAsDemo(role) → Promise<User>        // Demo mode
  signup(data) → Promise<{ user, sessionExists }>
  signInWithGoogle(intendedRole) → Promise<void>
  handleOAuthCallback() → Promise<User>    // OAuth redirect handler
  logout() → Promise<void>
  updateProfile(updates) → Promise<void>
  resetPasswordForEmail(email) → Promise<void>
  updatePassword(password) → Promise<void>
  refreshUser() → Promise<void>
}
```

### Key Implementation Patterns

#### Referential Stability — `setUserIfChanged()`
Prevents unnecessary re-renders by only updating state if user data actually changed:
```ts
const setUserIfChanged = useCallback((newUser) => {
  setUser(prev => {
    if (prev?.id === newUser?.id &&
        prev?.role === newUser?.role &&
        prev?.updatedAt === newUser?.updatedAt) {
      return prev; // ← No re-render triggered
    }
    return newUser;
  });
}, []);
```

#### Supabase Auth State Listener
```ts
useEffect(() => {
  refreshUser().finally(() => setLoading(false));

  const { data: { subscription } } = AuthService.onAuthStateChange((newUser) => {
    setUserIfChanged(newUser);
    setLoading(false);
  });

  return () => subscription.unsubscribe(); // cleanup
}, []);
```

#### `useMemo` on Context Value
Prevents child re-renders when unrelated state changes:
```ts
const contextValue = useMemo<AuthContextType>(() => ({
  user, loading, login, logout, signup, ...
}), [user, loading, login, logout, signup, ...]);
```

#### Usage in components
```tsx
function MyComponent() {
  const { user, logout } = useAuth();
  return <button onClick={logout}>Logout {user?.name}</button>;
}
```

---

## 🧩 Component Architecture

### Component Directory Structure

```
src/components/
├── auth/
│   └── RoleCard.tsx           ← Role selection card (onboarding)
│
├── food/
│   ├── FoodCard.tsx           ← Grid card for food listings
│   └── DiscoverFoodItem.tsx   ← Compact list item (discover page)
│
├── layout/
│   ├── AppShell.tsx           ← Authenticated app wrapper (Navbar + Sidebar + Outlet)
│   ├── Navbar.tsx             ← Top navigation bar
│   ├── Sidebar.tsx            ← Role-aware side navigation
│   ├── Footer.tsx             ← Public page footer
│   ├── RoleBasedDashboard.tsx ← Smart dashboard router by role
│   └── RoleRouteGuard.tsx     ← Route access control by role
│
├── map/
│   ├── FoodMap.tsx            ← Main Leaflet map view
│   └── DiscoverFoodMap.tsx    ← Discover page split-view map
│
├── states/
│   ├── LoadingState.tsx       ← Spinner / skeleton loader
│   ├── EmptyState.tsx         ← Empty data placeholder
│   └── ErrorState.tsx         ← Error display with retry
│
└── ui/
    └── UserAvatar.tsx         ← Circular avatar with initials fallback
```

---

### `AppShell` — Authenticated Layout Wrapper

The root layout for all authenticated pages. Uses React Router `<Outlet>` for child pages.

```
AppShell
├── <Navbar onToggleSidebar />    ← Top bar (hamburger, logo, notifications, avatar)
├── <Sidebar open onClose />      ← Collapsible side nav
└── <main>
      <Outlet />                  ← Current page renders here
    </main>
```

```tsx
export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className={styles.shell}>
      <Navbar onToggleSidebar={() => setSidebarOpen(s => !s)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />    {/* ← Child pages inject here */}
        </div>
      </main>
    </div>
  );
}
```

---

### `RoleBasedDashboard` — Auto-Redirect by Role

Reads `user.role` from AuthContext and redirects to the correct dashboard:

```
user.role === 'donor'    → /donor-dashboard
user.role === 'ngo'      → /ngo-dashboard
user.role === 'rider'    → /rider-dashboard
user.role === 'admin'    → /admin
user.role === 'community'→ /community-dashboard
default                  → /donor-dashboard
```

---

### State Components

| Component | Props | Usage |
|-----------|-------|-------|
| `LoadingState` | `message?`, `size?` | While data is fetching |
| `EmptyState` | `title`, `description`, `action?` | When list is empty |
| `ErrorState` | `message`, `onRetry?` | On query error |

---

## 📄 Pages Reference

### Public Pages

| Page | File | Description |
|------|------|-------------|
| **LandingPage** | `pages/public/LandingPage.tsx` | Hero section, how it works, CTA, testimonials |
| **AboutPage** | `pages/public/AboutPage.tsx` | Mission and team |
| **HowItWorksPage** | `pages/public/HowItWorksPage.tsx` | Step-by-step guide |
| **PublicImpactPage** | `pages/public/PublicImpactPage.tsx` | Community impact numbers |
| **PartnersPage** | `pages/public/PartnersPage.tsx` | Partner organizations |

### Auth Pages

| Page | File | Key Features |
|------|------|-------------|
| **RoleSelectPage** | `auth/RoleSelectPage.tsx` | Visual role cards for Donor / NGO / Rider |
| **DonorRegisterPage** | `auth/DonorRegisterPage.tsx` | Full donor registration + login (dual mode) |
| **AcceptorRegisterPage** | `auth/AcceptorRegisterPage.tsx` | NGO/acceptor registration + login |
| **RiderRegisterPage** | `auth/RiderRegisterPage.tsx` | Rider registration + login |
| **SingleRoleAuthPage** | `auth/SingleRoleAuthPage.tsx` | Generic auth form for any role |
| **AuthCallbackPage** | `auth/AuthCallbackPage.tsx` | Handles OAuth redirect |
| **ForgotPasswordPage** | `auth/ForgotPasswordPage.tsx` | Password reset request |
| **ResetPasswordPage** | `auth/ResetPasswordPage.tsx` | New password form |

### App Pages (Authenticated)

| Page | File | Role | Key Features |
|------|------|------|-------------|
| **DonorDashboardPage** | `app/DonorDashboardPage.tsx` | Donor | Stats, active listings, live rider tracking |
| **CreateDonationPage** | `app/CreateDonationPage.tsx` | Donor | 3-step wizard, Leaflet map pin, image upload |
| **DonorDonationsStatus** | `app/DonorDonationsStatus.tsx` | Donor | Donation history & claim details |
| **DonationDetailPage** | `app/DonationDetailPage.tsx` | Any | Full listing details |
| **DonationsPage** | `app/DonationsPage.tsx` | Any | All donations list |
| **NGOClaimsDashboard** | `app/NGOClaimsDashboard.tsx` | NGO | Claims lifecycle, receipt modal, distribution |
| **NGODiscoveryPage** | `app/NGODiscoveryPage.tsx` | Any | India NGO map + list with 12 categories |
| **RiderDashboardPage** | `app/RiderDashboardPage.tsx` | Rider | Available tasks, pickup verification, deliveries |
| **BeneficiaryDashboardPage** | `app/BeneficiaryDashboardPage.tsx` | Community | Food discovery for individuals |
| **AdminPage** | `app/AdminPage.tsx` | Admin | 3-tab: users, listings, system stats |
| **DiscoverPage** | `app/DiscoverPage.tsx` | Any | Browse food listings with filters |
| **MapPage** | `app/MapPage.tsx` | Any | Full-screen interactive food map |
| **ChatPage** | `app/ChatPage.tsx` | Any | Real-time messaging |
| **ImpactDashboardPage** | `app/ImpactDashboardPage.tsx` | Any | Community impact metrics |
| **NotificationsPage** | `app/NotificationsPage.tsx` | Any | Notification center |
| **ProfilePage** | `app/ProfilePage.tsx` | Any | View & edit profile |
| **SettingsPage** | `app/SettingsPage.tsx` | Any | Account settings |
| **VerificationPage** | `app/VerificationPage.tsx` | Any | Verification status |

---

## 🎨 Design System & Tokens

**File:** `src/styles/tokens.css`

All design decisions are defined as CSS custom properties on `:root`.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#c17b3f` | Terracotta / Warm Clay — primary buttons, links |
| `--color-secondary` | `#6b8e3e` | Muted Olive Green — success, verified badges |
| `--color-accent` | `#d4a853` | Warm Muted Gold — highlights, awards |
| `--color-bg` | `#faf7f2` | Warm off-white — app background |
| `--color-surface` | `#ffffff` | Cards, modals |
| `--color-text-primary` | `#1c1a17` | Main text |
| `--color-text-muted` | `#8b7355` | Secondary text |
| `--color-error` | `#dc2626` | Error states |
| `--color-success` | `#16a34a` | Success states |
| `--color-warning` | `#ca8a04` | Warnings, pickup-soon |
| `--color-urgent` | `#dc2626` | Urgent food listings |

### Typography

| Token | Value | Font |
|-------|-------|------|
| `--font-heading` | DM Sans, Inter, system-ui | Dashboard headings |
| `--font-serif` | Playfair Display, Georgia | Landing page display text |
| `--font-script` | Kalam, cursive | Handwritten accents |
| `--font-body` | Inter, system-ui | Body text everywhere |

Font sizes: `--text-xs` (0.75rem) → `--text-6xl` (3.75rem)

### Spacing Scale
Based on 4px grid: `--space-1` (0.25rem) → `--space-24` (6rem)

### Border Radius
`--radius-xs` (0.25rem) → `--radius-full` (9999px — pill shape)

### Shadow Scale
5 levels: `--shadow-xs` → `--shadow-xl`

### Layout Constants
```css
--sidebar-width:   260px
--navbar-height:   64px
--max-width:       1280px
--content-padding: 1.5rem
```

### Z-index Layers
```css
--z-dropdown: 100
--z-sticky:   200
--z-overlay:  300
--z-modal:    400
--z-toast:    500
```

### Transition Speeds
```css
--transition-fast: 150ms ease
--transition-base: 200ms ease
--transition-slow: 300ms ease
```

---

## ⚡ Performance Optimizations

### 1. Route-Level Code Splitting (Lazy Loading)

Every page except LandingPage is lazy-loaded. Only the code for the current route is downloaded:

```tsx
// Eager (instant load for critical path)
import LandingPage from './pages/public/LandingPage';

// Lazy (downloaded only when user navigates there)
const DonorDashboardPage = lazy(() => import('./pages/app/DonorDashboardPage'));
const NGODiscoveryPage   = lazy(() => import('./pages/app/NGODiscoveryPage'));
// ...all 20+ pages lazy loaded
```

### 2. Manual Chunk Splitting (Vite Build)

`vite.config.ts` splits vendor libraries into separate cached chunks:

```ts
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-leaflet';
    if (id.includes('@supabase'))          return 'vendor-supabase';
    if (id.includes('@tanstack'))          return 'vendor-query';
    if (id.includes('lucide-react'))       return 'vendor-icons';
    if (id.includes('react-router') ||
        id.includes('react-dom') ||
        id.includes('react/'))             return 'vendor-react';
  }
}
```

**Result:** Each vendor chunk is cached by the browser independently. When only app code changes, users re-download only the app chunk — not React, Leaflet, or Supabase.

| Chunk | Libraries | Cached Until |
|-------|-----------|-------------|
| `vendor-react` | react, react-dom, react-router | React version change |
| `vendor-supabase` | @supabase/supabase-js | Supabase version change |
| `vendor-leaflet` | leaflet, react-leaflet | Leaflet version change |
| `vendor-query` | @tanstack/react-query | TanStack version change |
| `vendor-icons` | lucide-react | Icon set version change |

### 3. TanStack React Query Caching

```ts
staleTime: 1000 * 60 * 2  // Data considered fresh for 2 minutes
retry: 1                    // Retry failed requests once
```

- API calls are **cached in memory** — navigating back to a page shows data instantly
- Background refetch when user focuses the tab (stale-while-revalidate)
- Loading states shown only on first fetch

### 4. `useCallback` and `useMemo` in AuthContext

All context functions wrapped in `useCallback` to prevent new function references on each render:
```ts
const login = useCallback(async (email, password) => { ... }, [setUserIfChanged]);
const logout = useCallback(async () => { ... }, []);
```

Context value wrapped in `useMemo` to prevent consumer re-renders:
```ts
const contextValue = useMemo(() => ({ user, loading, login, ... }), [user, loading, login, ...]);
```

### 5. Referential Stability in Auth State

`setUserIfChanged()` compares `id`, `role`, `updatedAt` before updating state — prevents re-renders when server returns same data.

### 6. CSS Modules (Scoped Styles)

Each component has its own `.module.css` file. Class names are auto-hashed at build time:
- No global class name conflicts
- Dead styles removed at build time
- No runtime CSS-in-JS overhead

### 7. `cssCodeSplit: true` in Vite

Each JS chunk has its own CSS file — styles for a lazy-loaded page are only downloaded when that page is visited.

### 8. Leaflet Lazy Loaded with Pages

The Leaflet library (~150KB) is in its own chunk and only downloaded when the user visits a map page.

### 9. Supabase JS Client — Singleton

`src/lib/supabase.ts` exports a single Supabase client instance shared across all services — no duplicate connections.

---

## 🏗️ Build System (Vite)

**File:** `vite.config.ts`

```ts
export default defineConfig({
  plugins: [react()],      // @vitejs/plugin-react (SWC-based)
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',           // Modern JS, no polyfills for old browsers
    cssCodeSplit: true,         // Per-chunk CSS files
    chunkSizeWarningLimit: 600, // Warn if chunk > 600KB
    rollupOptions: {
      output: {
        manualChunks(id) { ... }  // See chunk splitting above
      }
    }
  }
});
```

### Build Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite dev server on `localhost:3000` with HMR |
| `npm run build` | TypeScript check (`tsc -b`) + Vite production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run oxlint on the codebase |

### Deployment Config (`vercel.json`)

```json
{
  "framework": "vite",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

The rewrite rule makes React Router work with direct URL access and browser refresh.

---

## 🔧 Utility Library (`lib/`)

### `lib/supabase.ts` — Client Singleton
```ts
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Single instance imported by all service files — no duplicate WebSocket connections.

---

### `lib/uuid.ts` — UUID Safety Layer

Prevents `invalid input syntax for type uuid` database errors from invalid or legacy IDs.

#### `isValidUUID(val)` → `boolean`
```ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i;
export function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}
```

#### `toSafeUUID(val, fallback)` → `string`
Converts any ID to a valid UUID:
1. If already valid UUID → return as-is
2. If a known legacy demo ID string → map to real UUID
3. Otherwise → return fallback

```ts
toSafeUUID('demo-donor-001')  // → '51059a05-23eb-4d61-b856-20a42e790403'
toSafeUUID('invalid-id')      // → DEMO_RECORD_UUIDS.donor (fallback)
toSafeUUID('valid-uuid-...')  // → that UUID
```

#### Demo UUID Constants
```ts
export const DEMO_RECORD_UUIDS = {
  donor:          '51059a05-23eb-4d61-b856-20a42e790403',
  ngo:            'd3819150-4d31-4e95-8972-15b722d5f3e3',
  rider:          '4be44dd0-ffb1-4f9d-ae4e-3ec8689c3de0',
  volunteer:      'e5947beb-536d-4a35-bdfc-4507f61f12a4',
  admin:          '916af4a6-abc5-4387-a655-7cb1d614841a',
  donorSecondary: '9ecc652c-b90c-4e48-a56a-4c0d5db196be',
};
```

Real database UUIDs — allows demo mode to work with actual DB records.

---

## 📐 TypeScript Type System

**File:** `src/types/index.ts`

All shared types in one file, matching the Supabase DB schema exactly.

### Core Types

```ts
// User roles
type UserRole = 'donor' | 'ngo' | 'receiver' | 'volunteer' | 'partner' | 'admin' | 'rider' | 'community' | 'acceptor';

// Food status lifecycle
type FoodStatus = 'available' | 'reserved' | 'partially_reserved' | 'picked_up' | 'completed' | 'expired' | 'cancelled';

// Reservation status lifecycle
type ReservationStatus = 'pending' | 'confirmed' | 'ready_for_pickup' | 'picked_up' | 'completed' | 'cancelled' | 'expired';

// Notification events
type NotificationType = 'reservation_created' | 'reservation_confirmed' | 'pickup_ready' | 'pickup_completed' | 'donation_created' | 'donation_completed' | 'listing_expiring' | 'partner_verified' | 'donation_claimed' | 'system';

// Food categories (India-specific)
type FoodCategory = 'rice' | 'roti' | 'sabzi' | 'dal' | 'biryani' | 'snacks' | 'sweets' | 'fruits' | 'bakery' | 'beverages' | 'other';

// Dietary type
type FoodType = 'veg' | 'non_veg' | 'vegan' | 'other';
```

### Key Interfaces

```ts
interface User {
  id, name, email, phone, role, avatar?, bio?,
  organizationName?, registrationNumber?,
  location?: Location, isVerified, totalDonations,
  totalRescues, createdAt, updatedAt
}

interface FoodListing {
  id, donorId, donor?, title, description?,
  category, foodType, servings, availableServings,
  imageUrl?, pickupAddress?, city?,
  latitude?, longitude?,
  availableFrom, availableUntil,
  status, isUrgent, allergens?,
  storageType?, distanceKm?, createdAt, updatedAt
}

interface Reservation {
  id, foodListingId, foodListing?,
  userId, user?, servings,
  status, pickupTime?, notes?,
  createdAt, updatedAt
}

interface ChatMessage {
  id, conversationId, senderId, sender?,
  content, messageType: 'text'|'image'|'location'|'system',
  metadata?, isRead, createdAt
}

interface ImpactStats {
  mealsSaved, foodRedistributedKg, peopleReached,
  wastePreventedKg, co2SavedKg, donationsCount, claimsCount
}
```

### Generic Utility Types

```ts
interface PaginatedResponse<T> {
  data: T[], total: number, page: number,
  pageSize: number, hasMore: boolean
}

interface ApiResponse<T> {
  data: T | null, error: string | null, loading: boolean
}
```

---

## 🎨 CSS Architecture

### CSS Modules Pattern
Every component has a co-located `.module.css` file:
```
DonorDashboardPage.tsx
DonorDashboardPage.module.css    ← scoped styles
```

Usage in component:
```tsx
import styles from './DonorDashboardPage.module.css';
<div className={styles.container}>
```

At build time, `styles.container` becomes `DonorDashboardPage_container__abc12` — unique, no conflicts.

### Global Styles Files

| File | Purpose |
|------|---------|
| `styles/tokens.css` | CSS custom properties (design tokens) |
| `styles/global.css` | CSS reset, base styles, body fonts |
| `styles/leaflet-fix.css` | Override Leaflet default CSS for custom map styling |
| `src/index.css` | App-level base imports |
| `src/App.css` | App-level animation keyframes (spin, etc.) |

---

## 🛡️ Frontend Security Patterns

| Pattern | Implementation |
|---------|---------------|
| **Route Protection** | `ProtectedRoute` — redirects unauthenticated users |
| **Role Enforcement** | `RoleRouteGuard` — blocks wrong-role access to dashboards |
| **Public-Only Routes** | `PublicOnlyRoute` — redirects logged-in users away from auth pages |
| **UUID Validation** | `isValidUUID()` + `toSafeUUID()` — prevents invalid DB queries |
| **OAuth Security** | `RootRoute` detects access tokens and routes to callback handler |
| **Environment Variables** | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` via `.env` (not committed) |
| **Self-Claim Prevention** | `reserve_food()` RPC rejects donor claiming own food (server-side) |
| **Demo Mode Sandboxing** | Demo users use real UUIDs but can't affect other users' data (RLS) |
| **TypeScript Strict Mode** | Prevents `any` type holes that could lead to runtime errors |

---

## 🔄 Data Flow Patterns

### Pattern 1 — Component Data Fetching
```
Page mounts
  → useEffect / useQuery fires
  → Service function called (e.g. DonationService.getMyListings)
  → Supabase query runs
  → State updated → Component re-renders
  → TanStack Query caches result
  → Next visit: instant from cache, background refetch
```

### Pattern 2 — Form Submission
```
User fills form
  → Controlled state via useState
  → Submit button clicked
  → Service function called with form data
  → Supabase INSERT/UPDATE runs
  → Success → navigate() to new page
  → Error → show error message inline
```

### Pattern 3 — Realtime Updates (Chat / Notifications)
```
Page mounts
  → supabase.channel().on('postgres_changes').subscribe()
  → Database change happens (another user sends message)
  → Supabase Realtime pushes CDC event via WebSocket
  → Callback fires → setState updates
  → Component re-renders with new data
  → Page unmounts → subscription.unsubscribe()
```

### Pattern 4 — Auth Flow
```
App loads
  → AuthProvider mounts
  → AuthService.getCurrentUser() checks localStorage session
  → If session: user set in context → ProtectedRoutes open
  → If no session: user = null → ProtectedRoutes redirect to /register

User logs in
  → AuthService.login() calls supabase.auth.signInWithPassword()
  → Supabase returns JWT + user metadata
  → handle_new_user() trigger ensures profile exists
  → AuthContext.login() sets user state
  → getRoleDashboardPath(role) → navigate to correct dashboard
```

### Pattern 5 — OAuth Flow
```
User clicks "Sign in with Google"
  → AuthService.signInWithGoogle(role) stores role in localStorage
  → supabase.auth.signInWithOAuth({ provider: 'google' })
  → Browser redirects to Google
  → Google redirects back to /auth/callback?code=...
  → AuthCallbackPage handles token exchange
  → User created in Supabase Auth
  → handle_new_user() trigger creates profile with stored role
  → User redirected to their role dashboard
```

---

*Frontend Report — Sharebite v1.0 | November 2026*
*React 19 · TypeScript 6 · Vite 8 · React Router v7 · TanStack Query v5*
