/**
 * EZ Marketing Agency — Mock/Seed Data Re-export
 *
 * This file re-exports everything from src/data/seed/ for backward compatibility.
 * All components that import from here will continue to work.
 *
 * Do not add new data here — add it in src/data/seed/ instead.
 * See DEMO_REMOVAL_GUIDE.md for how to remove seed data.
 */

export {
  seedClients as mockClients,
} from './seed/clients'

export {
  seedVideos as mockVideos,
  seedComments as mockComments,
} from './seed/videos'

export {
  seedProjects as mockProjects,
} from './seed/projects'

export {
  seedPackages as mockPackages,
  seedInvoices as mockInvoices,
} from './seed/billing'

export {
  seedTeamMembers as mockTeamMembers,
} from './seed/team'

export {
  seedTasks as mockTasks,
} from './seed/tasks'

export {
  seedAssets as mockAssets,
} from './seed/assets'

export {
  seedBookings as mockBookings,
} from './seed/bookings'

export {
  seedNotifications as mockNotifications,
  seedActivity as mockActivity,
  seedRevenueData as revenueData,
  seedVideoStatusData as videoStatusData,
  seedPlatformData as platformData,
} from './seed/activity'
