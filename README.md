# EZ Marketing Agency — Media Operations System

End-to-end media operations platform for content agencies.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open [http://localhost:5173](http://localhost:5173)

---

## Authentication

Authentication is handled entirely by **Supabase Auth**. There are no built-in
demo or seed credentials — accounts must exist in your Supabase project.

Requires `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
`VITE_ENABLE_REAL_AUTH=true`. Without them, login and signup fail with a
configuration error rather than falling back to hardcoded accounts.

**Sign-in accepts:**

| Input | Resolves to |
|-------|-------------|
| Full email (`omar@ezmarketing.agency`) | used verbatim |
| Bare username (`omar`) | `omar@ezmarketing.agency`, then `omar@cl.agency` on rejection |

The `@cl.agency` retry is temporary backward compatibility for accounts created
before the rebrand — see **HANDOVER.md → Email Domain Migration**.

**Creating users:** invite via Supabase Dashboard → Authentication → Users, or
use the in-app signup flow (`/signup`), which calls `supabase.auth.signUp()`.

> Seed data still drives dashboards, clients, and billing views while
> `VITE_DEMO_MODE=true`. That is display data only — it has never been part of
> the auth path. See `DEMO_REMOVAL_GUIDE.md`.

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ENABLE_REAL_AUTH=false
VITE_DEMO_MODE=true
VITE_ENABLE_AI=false
VITE_APP_URL=https://your-app.vercel.app
OPENAI_API_KEY=sk-...   # server-side only
```

---

## Vercel Deployment

1. Connect your repo to Vercel
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add environment variables in Vercel Dashboard
5. **Important**: `OPENAI_API_KEY` must NOT have the `VITE_` prefix (server-side only)

---

## Supabase Setup

See [`supabase/README.md`](supabase/README.md) for full instructions.

Quick version:
```sql
-- Run in Supabase SQL Editor, in order:
-- 1. supabase/schema.sql
-- 2. supabase/rls-policies.sql
-- 3. supabase/storage.sql
-- 4. supabase/seed.sql (optional)
```

---

## Going Production

1. Follow `supabase/README.md` to set up the database
2. Follow `DEMO_REMOVAL_GUIDE.md` to switch from seed to real data
3. Deploy to Vercel with production env vars
4. Add `OPENAI_API_KEY` for AI Studio

---

## Project Structure

```
src/
├── components/
│   ├── auth/           # ProtectedRoute, RoleGuard
│   └── layout/         # AppLayout, ClientLayout, Sidebar, Navbar
├── config/
│   └── app.ts          # Feature flags and app constants
├── contexts/
│   └── AuthContext.tsx # Auth state (Supabase + seed fallback)
├── data/
│   ├── seed/           # Sample data for presentations
│   └── mockData.ts     # Re-export barrel (backward compat)
├── lib/
│   ├── supabase.ts     # Supabase client
│   └── utils.ts        # Utility functions
├── pages/
│   ├── app/dashboard   # Internal app pages
│   └── client/         # Client portal pages
├── services/           # Data layer (Supabase + seed fallback)
└── types/
    └── index.ts        # All TypeScript types

api/
└── ai/
    └── generate.ts     # Vercel serverless AI function

supabase/
├── schema.sql          # Database tables, indexes, triggers
├── rls-policies.sql    # Row level security
├── storage.sql         # Storage buckets and policies
├── seed.sql            # Initial data for Supabase
└── README.md           # Supabase setup guide
```

---

## Documentation

| File | Purpose |
|------|---------|
| `HANDOVER.md` | Complete system documentation for client |
| `DEMO_REMOVAL_GUIDE.md` | How to switch from seed to production data |
| `CLIENT_PRESENTATION_CHECKLIST.md` | Demo script for client walkthroughs |
| `supabase/README.md` | Supabase setup instructions |
