import type { TeamMember } from '../../types'

export const seedTeamMembers: TeamMember[] = [
  {
    id: 'tm1', agencyId: 'a1', name: 'Bassem Mahmoud', email: 'bassem@cl.agency',
    role: 'agency_admin', color: '#3B82F6', activeTasks: 8, completedThisWeek: 5,
    inProgressVideos: 3, availability: 'available', clients: ['c1', 'c2', 'c5'],
    joinedAt: '2023-01-01',
  },
  {
    id: 'tm2', agencyId: 'a1', name: 'Layla Kamal', email: 'layla@cl.agency',
    role: 'project_manager', color: '#8B5CF6', activeTasks: 12, completedThisWeek: 9,
    inProgressVideos: 0, availability: 'busy', clients: ['c1', 'c3', 'c4'],
    joinedAt: '2023-03-15',
  },
  {
    id: 'tm3', agencyId: 'a1', name: 'Omar Tarek', email: 'omar@cl.agency',
    role: 'editor', color: '#06B6D4', activeTasks: 15, completedThisWeek: 7,
    inProgressVideos: 5, availability: 'busy', clients: ['c1', 'c2', 'c3', 'c4', 'c5'],
    joinedAt: '2023-02-10',
  },
  {
    id: 'tm4', agencyId: 'a1', name: 'Nour Ibrahim', email: 'nour@cl.agency',
    role: 'editor', color: '#EC4899', activeTasks: 9, completedThisWeek: 11,
    inProgressVideos: 3, availability: 'available', clients: ['c1', 'c3'],
    joinedAt: '2023-06-01',
  },
  {
    id: 'tm5', agencyId: 'a1', name: 'Ahmed Samir', email: 'ahmed@cl.agency',
    role: 'social_manager', color: '#10B981', activeTasks: 6, completedThisWeek: 14,
    inProgressVideos: 0, availability: 'available', clients: ['c2', 'c5'],
    joinedAt: '2023-08-20',
  },
]
