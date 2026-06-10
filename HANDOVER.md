# CL — Media Operations System
## Client Handover Document

---

## What Was Built

A complete end-to-end **Media Operations Platform** for content agencies.

### Core Features

| Module | Description |
|--------|-------------|
| **Dashboard** | KPI overview, activity feed, revenue charts, pipeline status |
| **Clients** | CRM with client profiles, status, portal access control |
| **Video Pipeline** | Full production workflow: Idea → Script → Shooting → Editing → Review → Approved → Posted |
| **Content Calendar** | Monthly calendar view with platform/status/client filters |
| **AI Studio** | Hook generator, script writer, caption generator, content ideas, campaign angles, calendar planner |
| **Asset Library** | Brand files organized by client and folder |
| **Packages** | Monthly retainer management with usage tracking |
| **Billing** | Invoice creation and payment tracking |
| **Team** | Team member management with availability and assignment |
| **Tasks** | Kanban-style task management with video/client linking |
| **Bookings** | Shoot scheduling with shot lists and team assignment |
| **Analytics** | Revenue, video status, and platform distribution charts |
| **Notifications** | In-app notification system |
| **Client Portal** | Separate secure portal for clients to view their content, calendar, invoices, and packages |

---

## User Roles

| Role | What they can access |
|------|---------------------|
| `owner` / `admin` | Full system access |
| `project_manager` | Clients, projects, videos, tasks, calendar, bookings |
| `editor` | Assigned videos and tasks |
| `social_media_manager` | Calendar, content scheduling |
| `accountant` | Packages and billing only |
| `client` | Client portal — their own content only |
| `creator` | Assigned videos only |

---

## Main Routes

### Internal Dashboard (`/app/*`)
| Route | Page |
|-------|------|
| `/app/dashboard` | Main operations overview |
| `/app/clients` | Client list |
| `/app/clients/:id` | Client profile |
| `/app/pipeline` | Video pipeline |
| `/app/pipeline/:id` | Video detail |
| `/app/calendar` | Content calendar |
| `/app/ai` | AI Studio |
| `/app/assets` | Asset library |
| `/app/packages` | Package management |
| `/app/billing` | Invoices |
| `/app/team` | Team management |
| `/app/tasks` | Task board |
| `/app/analytics` | Analytics |
| `/app/booking` | Shoot bookings |
| `/app/notifications` | Notifications |
| `/app/settings` | Settings |

### Client Portal (`/client/*`)
| Route | Page |
|-------|------|
| `/client` | Client dashboard |
| `/client/videos` | Client's videos |
| `/client/calendar` | Client's content calendar |
| `/client/bookings` | Client's bookings |
| `/client/assets` | Client's brand assets |
| `/client/package` | Client's package & usage |
| `/client/invoices` | Client's invoices |

---

## Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Run SQL files in order:
   - `supabase/schema.sql`
   - `supabase/rls-policies.sql`
   - `supabase/storage.sql`
   - `supabase/seed.sql` (optional)
3. Create auth users in Dashboard → Authentication → Users
4. Update profile roles via SQL (see `supabase/README.md`)

---

## Vercel Deployment

1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel Dashboard:

| Variable | Where it goes | Description |
|----------|--------------|-------------|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon key |
| `VITE_ENABLE_REAL_AUTH` | Frontend | Set `true` to use Supabase auth |
| `VITE_DEMO_MODE` | Frontend | Set `false` for production |
| `VITE_ENABLE_AI` | Frontend | Set `true` to enable AI Studio |
| `VITE_APP_URL` | Frontend | Your Vercel URL |
| `OPENAI_API_KEY` | **Server-side only** | OpenAI API key (no VITE_ prefix!) |

3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Framework: Vite

---

## OpenAI Setup

1. Get API key at [platform.openai.com](https://platform.openai.com)
2. Add `OPENAI_API_KEY=sk-...` in Vercel → Environment Variables (NOT prefixed with VITE_)
3. Set `VITE_ENABLE_AI=true` in Vercel → Environment Variables
4. The AI Studio will now call `/api/ai/generate` (Vercel serverless function)

---

## Storage Buckets

Created by `supabase/storage.sql`:

| Bucket | Purpose | Public |
|--------|---------|--------|
| `client-assets` | Logos, fonts, brand files | No |
| `raw-footage` | Raw video uploads | No |
| `video-versions` | Review copies | No |
| `final-deliveries` | Final exported videos | No |
| `thumbnails` | Video preview images | Yes |
| `invoices` | Invoice PDFs | No |

---

## How to Add First Real Client

1. Go to `/app/clients`
2. Click "Add Client"
3. Fill in client details
4. Toggle "Enable Portal Access" to give them a client login
5. Create a Supabase auth user with their email
6. Update their profile to `role = 'client'` and link `portal_user_id`

---

## How to Create Team Users

1. Invite user via Supabase Dashboard → Authentication → Users → Invite
2. Once they accept, update their profile:
```sql
UPDATE profiles
SET agency_id = 'your-agency-uuid', role = 'editor', full_name = 'Their Name'
WHERE email = 'their@email.com';
```

---

## How to Remove Seed Mode

See `DEMO_REMOVAL_GUIDE.md` for complete instructions.

Quick version:
1. Set `VITE_DEMO_MODE=false`
2. Set `VITE_ENABLE_REAL_AUTH=true`
3. Configure Supabase
4. Delete `src/data/seed/` after everything works

---

## Known Limitations

1. **No real-time updates** — Data refreshes on page navigation, not live
2. **No video player** — Video preview shows metadata only (use an external player URL)
3. **No email notifications** — Supabase Edge Functions can add these later
4. **No multi-agency UI** — Super admin panel for managing multiple agencies not built
5. **AI fallback** — When AI is disabled, the AI Studio shows template-based results

---

## Recommended Next Features

1. **Real-time notifications** — Supabase Realtime subscriptions
2. **Video player integration** — Mux or Cloudflare Stream for review
3. **Email automation** — Supabase Edge Functions + Resend/SendGrid
4. **Client approval workflows** — One-click approve/reject with email
5. **Multi-language support** — Arabic + English
6. **Mobile app** — React Native with the same Supabase backend
7. **Reporting exports** — PDF reports for clients and agency analytics
8. **Stripe integration** — Online invoice payment
