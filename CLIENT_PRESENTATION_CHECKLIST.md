# EZ Marketing Agency — Client Presentation Checklist

Use this during live demos or client walkthroughs.

---

## Before the Demo

- [ ] Open `http://localhost:5173` (or your deployed URL)
- [ ] Confirm you see the login page (no hardcoded demo panel visible)
- [ ] Have credentials ready (see DEMO_REMOVAL_GUIDE.md for seed accounts)

---

## 1. Admin Login

- [ ] Go to `/login`
- [ ] Sign in as admin
- [ ] Confirm redirect to `/app/dashboard`
- [ ] Show: KPI cards, revenue chart, recent activity, pipeline snapshot

---

## 2. Client Management

- [ ] Navigate to `/app/clients`
- [ ] Show client cards with industry tags, package status, portal badge
- [ ] Click on a client to show the full profile
- [ ] Show: videos, projects, package usage, invoice history per client

---

## 3. Video Pipeline

- [ ] Navigate to `/app/pipeline`
- [ ] Show the Kanban/pipeline view across all statuses
- [ ] Click on a video to show the detail page
- [ ] Show: version history, review comments (internal vs client), status progression
- [ ] Demo: updating a video status

---

## 4. AI Studio

- [ ] Navigate to `/app/ai`
- [ ] Fill in: Company Name, Industry, Description, Platform, Tone
- [ ] Generate Hooks — show 5 platform-specific hooks
- [ ] Generate Scripts — show a full reel script with scenes
- [ ] Generate Content Ideas — show 5 detailed ideas
- [ ] Show: Copy button, save to project option
- [ ] Note: Real OpenAI integration requires API key setup (see HANDOVER.md)

---

## 5. Client Portal

- [ ] Log out from admin
- [ ] Log in as client user
- [ ] Confirm redirect to `/client`
- [ ] Show: client dashboard with their videos, package usage, next booking
- [ ] Navigate to Videos — show status badges
- [ ] Navigate to Calendar — show monthly view
- [ ] Navigate to Package — show usage bars
- [ ] Navigate to Invoices — show payment history
- [ ] Confirm: no internal data visible (no analytics, no team costs, no other clients)

---

## 6. Content Calendar

- [ ] Log back in as admin
- [ ] Navigate to `/app/calendar`
- [ ] Show monthly calendar with colored platform dots
- [ ] Filter by client or platform
- [ ] Click a day to show scheduled items

---

## 7. Packages & Billing

- [ ] Navigate to `/app/packages`
- [ ] Show package cards with usage progress bars
- [ ] Navigate to `/app/billing`
- [ ] Show invoice list with status (paid/sent/overdue)

---

## 8. Team & Tasks

- [ ] Navigate to `/app/team`
- [ ] Show team member cards with availability, active tasks
- [ ] Navigate to `/app/tasks`
- [ ] Show task board by status

---

## 9. Shooting Bookings

- [ ] Navigate to `/app/booking`
- [ ] Show booking cards with location, team, shot list

---

## 10. Asset Library

- [ ] Navigate to `/app/assets`
- [ ] Show assets organized by client and folder
- [ ] Show: logos, videos, music, documents

---

## After the Demo

**Deployment steps to go live:**
1. Set up Supabase project (run SQL files)
2. Create real users in Supabase Dashboard
3. Deploy to Vercel with environment variables
4. Add `OPENAI_API_KEY` for live AI generation
5. Point custom domain (optional)

**Reference:**
- Full setup: `HANDOVER.md`
- Remove seed data: `DEMO_REMOVAL_GUIDE.md`
- Database design: `supabase/schema.sql`
