import type { Task } from '../../types'

export const seedTasks: Task[] = [
  {
    id: 't1', title: 'Edit Summer Collection opening hook', assignedTo: 'tm3',
    assignedToName: 'Omar Tarek', assignedToColor: '#06B6D4', status: 'in_progress',
    priority: 'urgent', dueDate: '2024-05-07', clientId: 'c1', clientName: 'Nile Brands',
    videoId: 'v1', createdAt: '2024-05-05',
    description: 'Client requested faster cut at opening. Turn down music by 3db.',
  },
  {
    id: 't2', title: 'Write script for Spring Lookbook teaser', assignedTo: 'tm4',
    assignedToName: 'Nour Ibrahim', assignedToColor: '#EC4899', status: 'todo',
    priority: 'medium', dueDate: '2024-05-12', clientId: 'c1', clientName: 'Nile Brands',
    videoId: 'v10', createdAt: '2024-05-02',
  },
  {
    id: 't3', title: 'Color grade Ramadan Menu video', assignedTo: 'tm3',
    assignedToName: 'Omar Tarek', assignedToColor: '#06B6D4', status: 'in_progress',
    priority: 'high', dueDate: '2024-05-08', clientId: 'c2', clientName: 'Cairo Eats',
    videoId: 'v2', createdAt: '2024-04-29',
  },
  {
    id: 't4', title: 'Schedule FitZone transformation reel on TikTok', assignedTo: 'tm5',
    assignedToName: 'Ahmed Samir', assignedToColor: '#10B981', status: 'todo',
    priority: 'medium', dueDate: '2024-05-08', clientId: 'c5', clientName: 'FitZone Gym',
    videoId: 'v6', createdAt: '2024-05-04',
  },
  {
    id: 't5', title: 'Create captions for TechVision explainer', assignedTo: 'tm4',
    assignedToName: 'Nour Ibrahim', assignedToColor: '#EC4899', status: 'done',
    priority: 'medium', dueDate: '2024-05-05', clientId: 'c3', clientName: 'TechVision',
    videoId: 'v3', createdAt: '2024-04-30',
  },
  {
    id: 't6', title: 'Fix logo animation — Cairo Eats Alexandria reel', assignedTo: 'tm3',
    assignedToName: 'Omar Tarek', assignedToColor: '#06B6D4', status: 'todo',
    priority: 'urgent', dueDate: '2024-05-06', clientId: 'c2', clientName: 'Cairo Eats',
    videoId: 'v7', createdAt: '2024-05-04',
  },
  {
    id: 't7', title: 'Send May invoices to all active clients', assignedTo: 'tm1',
    assignedToName: 'Bassem Mahmoud', assignedToColor: '#3B82F6', status: 'in_progress',
    priority: 'high', dueDate: '2024-05-05', createdAt: '2024-05-01',
  },
  {
    id: 't8', title: 'Onboard Desert Palm Hotel — portal setup', assignedTo: 'tm2',
    assignedToName: 'Layla Kamal', assignedToColor: '#8B5CF6', status: 'waiting',
    priority: 'low', dueDate: '2024-05-15', clientId: 'c4', clientName: 'Desert Palm',
    createdAt: '2024-05-01',
    description: 'Waiting for client to confirm their preferred login email.',
  },
]
