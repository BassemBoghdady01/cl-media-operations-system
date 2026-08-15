# Demo Data — Remove Before Production

This file documents where all demo/mock data lives.
When connecting a real database, delete these files and replace with real API calls.

## Location of Demo Data

```
src/data/mockData.ts          ← ALL demo data lives here
src/contexts/AuthContext.tsx  ← Demo user accounts (DEMO_USERS object)
```

## Demo Data Includes

| Data | File | Variable |
|------|------|----------|
| 6 Clients | mockData.ts | `mockClients` |
| 11 Videos | mockData.ts | `mockVideos` |
| 4 Packages | mockData.ts | `mockPackages` |
| 6 Invoices | mockData.ts | `mockInvoices` |
| 5 Team Members | mockData.ts | `mockTeamMembers` |
| 8 Tasks | mockData.ts | `mockTasks` |
| 8 Assets | mockData.ts | `mockAssets` |
| 2 Bookings | mockData.ts | `mockBookings` |
| 6 Notifications | mockData.ts | `mockNotifications` |
| 6 Activity Items | mockData.ts | `mockActivity` |
| Revenue Chart Data | mockData.ts | `revenueData` |
| Video Status Data | mockData.ts | `videoStatusData` |
| Platform Data | mockData.ts | `platformData` |

## Demo User Accounts — REMOVED

The demo accounts previously listed here have been deleted from
`AuthContext.tsx`. Sign-in and sign-up go through Supabase Auth only; there are
no hardcoded credentials in the frontend.

## How to Remove Demo Data

1. Delete `src/data/mockData.ts`
2. Replace all imports of `mockData` with real Supabase/API calls via `src/services/`
3. Update `src/contexts/AuthContext.tsx` to use real Supabase Auth
4. Keep `src/types/index.ts` — the interfaces are production-ready

## Services Layer (ready for real data)

```
src/services/
  videos.ts      ← CRUD for videos
  clients.ts     ← CRUD for clients
  invoices.ts    ← CRUD for invoices
  packages.ts    ← CRUD for packages
  ai.ts          ← OpenAI integration
  storage.ts     ← File upload/download
```

These are stub files ready to be filled with real Supabase queries.
