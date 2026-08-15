# EZ Marketing Agency — Demo / Seed Data Removal Guide

This document explains where all seed/demo data lives, how to disable it, and how to switch to real Supabase data.

---

## Current State

The app is in **seed mode** by default (`VITE_DEMO_MODE=true`).

In seed mode:
- All data is loaded from `src/data/seed/` (static TypeScript files)
- Authentication uses hardcoded usernames/passwords
- No real database is required
- Uploads and AI generation are stubs (no API keys needed)

---

## Where Demo/Seed Data Lives

| File | What it contains |
|------|-----------------|
| `src/data/seed/clients.ts` | 6 sample clients (Nile Brands, Cairo Eats, etc.) |
| `src/data/seed/videos.ts` | 11 sample videos across different statuses |
| `src/data/seed/projects.ts` | 4 sample projects |
| `src/data/seed/billing.ts` | Sample packages + invoices with EZ invoice numbers |
| `src/data/seed/team.ts` | 5 team members with `@ezmarketing.agency` emails |
| `src/data/seed/tasks.ts` | 8 sample tasks |
| `src/data/seed/assets.ts` | 8 sample brand assets |
| `src/data/seed/bookings.ts` | 2 sample shoot bookings |
| `src/data/seed/activity.ts` | Notifications, activity feed, analytics chart data |
| `src/data/seed/index.ts` | Re-exports everything |
| `src/data/mockData.ts` | Backward-compat re-export (can delete once services are live) |

### Seed Auth Users — REMOVED

The `SEED_USERS` constant and its demo credentials have been deleted from
`src/contexts/AuthContext.tsx`. Authentication now runs exclusively through
Supabase Auth (`signInWithPassword` / `signUp`), with no credential fallback.

Nothing remains to remove here. The seed data below is **display data only** and
is independent of authentication.

---

## Step-by-Step: Switch to Production Mode

### 1. Set up Supabase (see `supabase/README.md`)

Run the SQL files in order:
```
supabase/schema.sql
supabase/rls-policies.sql
supabase/storage.sql
supabase/seed.sql  (optional, for initial data)
```

### 2. Create real users in Supabase Dashboard

Go to: **Authentication → Users → Invite User**

Create your team members and assign them roles via SQL:
```sql
UPDATE profiles
SET agency_id = 'your-agency-id', role = 'admin', full_name = 'Your Name'
WHERE id = 'auth-user-uuid';
```

### 3. Update environment variables

In `.env.local` (local) or Vercel Dashboard (production):

```env
VITE_SUPABASE_URL=https://your-real-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-real-anon-key
VITE_ENABLE_REAL_AUTH=true
VITE_DEMO_MODE=false
VITE_ENABLE_AI=true
OPENAI_API_KEY=sk-your-openai-key
```

### 4. Verify the switch worked

- Go to `/login`
- Use real Supabase credentials
- Data should load from Supabase, not seed files

### 5. Delete seed files (optional, when comfortable)

Once Supabase is working:

```bash
rm -rf src/data/seed/
rm src/data/mockData.ts
```

Then remove seed imports from `AuthContext.tsx` (the `SEED_USERS` constant and the seed fallback login branch).

---

## How the Data Provider Pattern Works

Each service file (`src/services/videoService.ts`, etc.) checks:

```typescript
if (!isSupabaseReady || !supabase) return seedData
// else: run Supabase query
```

`isSupabaseReady` is `true` only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set and valid.

This means:
- **No env vars** → seed data (safe for local dev and client presentations)
- **Valid env vars** → real Supabase data

---

## How to Disable Demo Credentials

Before going fully live with real clients:

1. Open `src/contexts/AuthContext.tsx`
2. Delete the `SEED_USERS` constant
3. Delete the seed fallback login branch (the `else` block in `login()`)
4. Set `VITE_ENABLE_REAL_AUTH=true`

---

## AI Studio

The AI Studio currently shows hardcoded template results.

To enable real OpenAI generation:
1. Set `VITE_ENABLE_AI=true`
2. Add `OPENAI_API_KEY=sk-...` to Vercel environment (server-side only)
3. The frontend calls `/api/ai/generate` (Vercel serverless function)
4. The key is never sent to the browser

---

## Summary Checklist

- [ ] Supabase project created
- [ ] SQL files run in correct order
- [ ] Real team users created in Supabase Dashboard
- [ ] Profile roles updated in `profiles` table
- [ ] First real client added
- [ ] Environment variables updated in Vercel
- [ ] `VITE_DEMO_MODE=false` set
- [ ] `VITE_ENABLE_REAL_AUTH=true` set
- [ ] Seed files deleted after confirming everything works
- [ ] SEED_USERS removed from AuthContext
- [ ] OpenAI connected (optional)
