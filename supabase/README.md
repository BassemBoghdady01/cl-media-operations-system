# CL — Supabase Setup Guide

## Overview

This folder contains all SQL files needed to set up the CL Media Operations System backend.

## Run Order

```
1. schema.sql       — Creates all tables, indexes, and triggers
2. rls-policies.sql — Enables RLS and creates security policies
3. storage.sql      — Creates storage buckets and access policies
4. seed.sql         — (Optional) Inserts sample data for initial setup
```

---

## Setup Steps

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Note your **Project URL** and **Anon Key** (Settings → API)

### 2. Run SQL Files

Go to **Supabase Dashboard → SQL Editor** and run each file in order:

```sql
-- Paste contents of schema.sql and run
-- Paste contents of rls-policies.sql and run
-- Paste contents of storage.sql and run
-- Paste contents of seed.sql and run (optional)
```

### 3. Create Auth Users

Supabase Auth users **cannot be created via SQL** (for security reasons).
Create users through one of these methods:

#### Option A: Supabase Dashboard (Recommended for setup)
1. Go to **Authentication → Users → Invite User**
2. Create these users:
   - `admin@cl.agency` — role: admin
   - `manager@cl.agency` — role: project_manager
   - `editor@cl.agency` — role: editor
   - `finance@cl.agency` — role: accountant
   - `client@cl.agency` — role: client (for portal testing)

#### Option B: Supabase Auth API (Programmatic)
```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users' \
  -H 'apikey: YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cl.agency","password":"your-secure-password","email_confirm":true}'
```

#### Option C: Sign Up via App
Users can sign up via `/signup` in the app.

### 4. Update Profile Roles

After creating auth users, update their profiles with correct roles and agency_id:

```sql
-- Replace 'AUTH_USER_UUID' with the actual UUID from auth.users
UPDATE profiles
SET
  agency_id = 'a1000000-0000-0000-0000-000000000001',
  role = 'admin',
  full_name = 'Agency Admin',
  color = '#3B82F6'
WHERE id = 'AUTH_USER_UUID';
```

### 5. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ENABLE_REAL_AUTH=true
VITE_DEMO_MODE=false
```

---

## Multi-Tenancy

The system is fully multi-tenant. Every table with tenant data has an `agency_id` column.

- Each user belongs to one agency via `profiles.agency_id`
- All data is isolated by `agency_id` through RLS policies
- The helper function `get_my_agency_id()` returns the current user's agency

To create a second agency (for a second client company):
1. Insert a new row into `agencies`
2. Create auth users and assign them to the new `agency_id` in `profiles`

---

## Storage Buckets

| Bucket | Public | Max Size | Usage |
|--------|--------|----------|-------|
| `client-assets` | No | 50MB | Logos, brand files, fonts |
| `raw-footage` | No | 5GB | Raw video uploads |
| `video-versions` | No | 2GB | Review copies for client |
| `final-deliveries` | No | 2GB | Final exported videos |
| `thumbnails` | **Yes** | 10MB | Video preview images |
| `invoices` | No | 10MB | Invoice PDFs |

File path convention: `{bucket}/{agency_id}/{client_id}/{filename}`

---

## Role Reference

| Role | Access |
|------|--------|
| `owner` | Full system access |
| `admin` | Full agency access |
| `project_manager` | Clients, projects, videos, tasks |
| `editor` | Assigned videos and tasks only |
| `social_media_manager` | Calendar, content scheduling |
| `accountant` | Packages and invoices only |
| `client` | Own portal data only |
| `creator` | Assigned videos only |

---

## Connecting to the App

Once Supabase is configured, update these env vars:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ENABLE_REAL_AUTH=true
VITE_DEMO_MODE=false
VITE_ENABLE_AI=true          # if OpenAI is configured
OPENAI_API_KEY=...           # server-side only (Vercel)
```

The app's data provider will automatically switch from seed data to Supabase.
