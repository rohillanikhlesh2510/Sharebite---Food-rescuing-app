# 🚀 Sharebite — Complete Deployment & DevOps Runbook

> Step-by-step production rollout guide, cloud topology, Vercel Edge deployment, Supabase database migration runbook, Deno edge function deployment, and CI/CD pipelines.

---

## 📋 Table of Contents

1. [Cloud Architecture & Production Topology](#-1-cloud-architecture--production-topology)
2. [Prerequisites & CLI Tooling](#-2-prerequisites--cli-tooling)
3. [Environment Variables & Secret Management](#-3-environment-variables--secret-management)
4. [Database Provisioning & Schema Migration](#-4-database-provisioning--schema-migration)
5. [Deno Edge Function Deployment](#-5-deno-edge-function-deployment)
6. [Vercel Edge Production Deployment](#-6-vercel-edge-production-deployment)
7. [GitHub Actions CI/CD Pipeline Automation](#-7-github-actions-cicd-pipeline-automation)
8. [Zero-Downtime Migration Strategy](#-8-zero-downtime-migration-strategy)
9. [Observability, Monitoring & Alerts](#-9-observability-monitoring--alerts)
10. [Disaster Recovery & Rollback Runbook](#-10-disaster-recovery--rollback-runbook)

---

## ☁️ 1. Cloud Architecture & Production Topology

Sharebite operates on a globally distributed, low-latency cloud topology:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GLOBAL USERS / CLIENTS                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (TLS 1.3) / Anycast DNS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  TIER 1: VERCEL GLOBAL EDGE NETWORK                                    │
│  - Single-Page Application (SPA) static asset serving                  │
│  - Brotli/Gzip compression & HTTP/2 push                               │
│  - Client-side routing rewrite rules via `vercel.json`                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  TIER 2: SUPABASE CLOUD      │          │  TIER 3: DENO EDGE FUNCTIONS │
│  - PostgreSQL 15 DB Engine   │          │  - `moderate-image` Runtime  │
│  - GoTrue Auth (JWT Service) │          │  - HuggingFace Vision AI API │
│  - PostgREST Auto API Engine │          │  - Secrets in Supabase Vault │
│  - Realtime WebSockets (WSS) │          └──────────────────────────────┘
│  - S3 Storage (Food Photos)  │
└──────────────────────────────┘
```

---

## 🛠️ 2. Prerequisites & CLI Tooling

Ensure the following runtimes and command-line interfaces are installed locally:

```bash
# 1. Node.js (v18.0.0 or higher)
node --version

# 2. Install Supabase CLI
npm install -g supabase

# 3. Install Vercel CLI
npm install -g vercel

# 4. Verify Git
git --version
```

---

## 🔐 3. Environment Variables & Secret Management

Security rules dictate a strict boundary between public client variables and private server secrets:

### 3.1 Client-Side Environment Variables (`.env.production`)
*Safe to be bundled into the compiled frontend.*

```env
# Supabase Project Base URL
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Public Anonymous API Key (Restricted by Row-Level Security)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3.2 Server & Edge Vault Secrets
*Never exposed to the client; stored exclusively in encrypted vaults.*

```bash
# HuggingFace Vision Inference API Key (Free tier token from huggingface.co/settings/tokens)
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase Service Role Key (Bypasses RLS for automated moderation logging)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Maximum Image Upload Threshold (Default 5 MB)
MAX_IMAGE_SIZE_MB=5
```

---

## 🗄️ 4. Database Provisioning & Schema Migration

### Method A: Supabase Web Dashboard (Recommended for Quick Setup)
1. Navigate to [Supabase Management Console](https://supabase.com/dashboard) and create a new project.
2. Under **Project Settings** ➔ **API**, copy your `Project URL` and `anon public` key.
3. Open the **SQL Editor** tab from the left sidebar.
4. Click **New Query**.
5. Copy the entire contents of [`supabase/complete_schema.sql`](./Sharebite%20food%20rescuing%20app/supabase/complete_schema.sql).
6. Paste into the editor and click **Run**.

### Method B: Supabase CLI (Automated Terminal Setup)
```bash
# 1. Authenticate Supabase CLI
supabase login

# 2. Link local project to remote instance
supabase link --project-ref your-project-id

# 3. Push schema migrations to production
supabase db push
```

### 4.2 Storage Buckets Setup
The database schema references public storage buckets. Execute the following in Supabase SQL editor if not auto-created:

```sql
-- Create food images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-images', 'food-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set Public Read Access
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id IN ('food-images', 'avatars'));

-- Set Authenticated Upload Access
CREATE POLICY "Authenticated Users Upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id IN ('food-images', 'avatars')
  AND auth.role() = 'authenticated'
);
```

---

## ⚡ 5. Deno Edge Function Deployment

The AI image moderation engine runs as a serverless Deno edge function.

### 5.1 Setting Edge Secrets in Supabase Vault
```bash
# Push private API tokens to the Supabase Edge Vault
supabase secrets set HF_TOKEN=hf_your_huggingface_token
supabase secrets set MAX_IMAGE_SIZE_MB=5
```

### 5.2 Deploying the Function
Navigate to the root directory and run:
```bash
cd "Sharebite food rescuing app"

# Deploy moderate-image edge function
supabase functions deploy moderate-image --no-verify-jwt
```

### 5.3 Verifying Function Health
Test the deployed endpoint using `curl`:
```bash
curl -i --location --request POST 'https://your-project-id.supabase.co/functions/v1/moderate-image' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
    "foodName": "Fresh Pulao",
    "userId": "51059a05-23eb-4d61-b856-20a42e790403"
  }'
```
*Expected response: `{"decision": "approved", "is_food": true, ...}`*

---

## 🌐 6. Vercel Edge Production Deployment

Sharebite is optimized for one-click deployment on Vercel's global edge network.

### 6.1 `vercel.json` Routing Configuration
Ensures client-side SPA routing redirects sub-routes (`/donor-dashboard`, `/map`, `/chat`) to `index.html`:

```json
{
  "framework": "vite",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 6.2 Deploying via Vercel CLI
```bash
cd "Sharebite food rescuing app"

# 1. Login to Vercel
vercel login

# 2. Link Project
vercel link

# 3. Pull Environment Settings
vercel env pull .env.production

# 4. Deploy to Production
vercel --prod
```

### 6.3 Deploying via GitHub Git Integration (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) ➔ Click **Add New** ➔ **Project**.
2. Select your repository: `rohillanikhlesh2510/Sharebite---Food-rescuing-app`.
3. Set **Root Directory** to: `Sharebite food rescuing app`.
4. Under **Build and Output Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `tsc -b && vite build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-anon-key`
6. Click **Deploy**. Vercel will build and assign an SSL certificate automatically!

---

## 🤖 7. GitHub Actions CI/CD Pipeline Automation

Create `.github/workflows/deploy.yml` in your repository to automate quality checks and deployments on every push:

```yaml
name: Sharebite CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  verify-and-test:
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: './Sharebite food rescuing app'

    steps:
      - name: 📥 Checkout Repository
        uses: actions/checkout@v4

      - name: ⚙️ Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: './Sharebite food rescuing app/package-lock.json'

      - name: 📦 Install Dependencies
        run: npm ci

      - name: 🔍 TypeScript Compilation Check
        run: npx tsc -b

      - name: 🏗️ Production Build Check
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

---

## 🔄 8. Zero-Downtime Migration Strategy

When updating database schema in a production environment:

1. **Always Use Additive Changes**:
   - Add new columns with `DEFAULT` or `NULL` values (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
   - Never rename or drop active columns in the same release as application code changes.
2. **Backward-Compatible Dual Deploy**:
   - Step 1: Deploy database migration containing new column / RPC.
   - Step 2: Deploy new frontend code utilizing the new fields.
   - Step 3: Deprecate old fields only in subsequent releases.
3. **Canonical Idempotency**:
   - All migrations must use `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION` to allow safe re-execution.

---

## 📊 9. Observability, Monitoring & Alerts

| Layer | Tooling | Metrics Monitored | Critical Alert Threshold |
|:---|:---|:---|:---|
| **Frontend SPA** | Vercel Analytics / Speed Insights | Core Web Vitals (LCP, FID, CLS) | LCP > 2.5s |
| **API Gateway** | Supabase API Logs | HTTP 5xx Error Rates, Latency | Error rate > 1% in 5 min |
| **Database** | PostgreSQL Query Insights | Active connections, Cache hit ratio | CPU > 85%, Conn > 80% |
| **Realtime** | Supabase Realtime Inspector | Active WebSocket channels, message drop | Disconnection spikes |
| **Edge Functions**| Deno Function Invocation Logs | Execution duration, HF 503 fallback rate | Failures > 5% |

---

## 🚨 10. Disaster Recovery & Rollback Runbook

### 10.1 Instant Frontend Rollback (Vercel)
If a bad build reaches production:
1. Open **Vercel Dashboard** ➔ Select Sharebite project.
2. Click **Deployments** tab.
3. Locate the previous stable build.
4. Click the three dots `...` ➔ Click **Promote to Production**.
5. Rollback executes across global edge nodes in **< 10 seconds** without rebuilding.

### 10.2 Database Recovery (Supabase PITR)
1. Go to **Database** ➔ **Backups**.
2. Select **Point-in-Time Recovery (PITR)**.
3. Select timestamp prior to erroneous migration or corruption event.
4. Trigger automated restore.

---

*Sharebite DevOps & Cloud Runbook — Certified Production Standard | November 2026*
