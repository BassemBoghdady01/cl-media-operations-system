import type { Project } from '../../../types'

export const seedProjects: Project[] = [
  {
    id: 'pr1', agencyId: 'a1', clientId: 'c1', clientName: 'Nile Brands Co.',
    name: 'Summer 2024 Campaign', type: 'Campaign', status: 'active',
    startDate: '2024-04-01', dueDate: '2024-06-30', progress: 65,
    teamIds: ['tm1', 'tm2', 'tm3', 'tm4'],
    description: '12 reels + 4 brand ads for the summer collection launch.',
  },
  {
    id: 'pr2', agencyId: 'a1', clientId: 'c2', clientName: 'Cairo Eats',
    name: 'Ramadan & Eid Content Series', type: 'Series', status: 'active',
    startDate: '2024-03-20', dueDate: '2024-05-15', progress: 80,
    teamIds: ['tm1', 'tm3', 'tm5'],
    description: '8 reels for Ramadan + 4 for Eid celebrations.',
  },
  {
    id: 'pr3', agencyId: 'a1', clientId: 'c3', clientName: 'TechVision Egypt',
    name: 'Q2 Product Launch — TechVision Pro', type: 'Product Launch', status: 'active',
    startDate: '2024-04-15', dueDate: '2024-05-31', progress: 45,
    teamIds: ['tm2', 'tm3', 'tm4'],
    description: 'Full launch content: explainer, case studies, social reels.',
  },
  {
    id: 'pr4', agencyId: 'a1', clientId: 'c5', clientName: 'FitZone Gym',
    name: 'Monthly Content Machine — May', type: 'Monthly Retainer', status: 'active',
    startDate: '2024-05-01', dueDate: '2024-05-31', progress: 30,
    teamIds: ['tm1', 'tm3', 'tm5'],
    description: '12 reels + TikTok content for May.',
  },
]
