import type { Notification, ActivityItem } from '../../types'

export const seedNotifications: Notification[] = [
  {
    id: 'n1', userId: 'tm1', type: 'video_review', title: 'Client Review Requested',
    message: 'Farida Hassan reviewed "Summer Collection Launch Reel" and left 2 comments.',
    isRead: false, createdAt: '2024-05-05T14:30:00', link: '/app/pipeline/v1',
    clientName: 'Nile Brands',
  },
  {
    id: 'n2', userId: 'tm1', type: 'revision_request', title: 'Revision Requested',
    message: 'Karim Nasser requested changes on "Alexandria Branch Opening" — 2 timestamps.',
    isRead: false, createdAt: '2024-05-04T10:35:00', link: '/app/pipeline/v7',
    clientName: 'Cairo Eats',
  },
  {
    id: 'n3', userId: 'tm1', type: 'approval', title: 'Video Approved ✓',
    message: 'TechVision Egypt approved "AI Product Explainer" — ready to schedule.',
    isRead: false, createdAt: '2024-05-04T09:00:00', link: '/app/pipeline/v3',
    clientName: 'TechVision',
  },
  {
    id: 'n4', userId: 'tm1', type: 'invoice', title: 'Invoice Overdue',
    message: 'Invoice CL-2024-0044 for Desert Palm Hotel is 5 days overdue ($3,052).',
    isRead: false, createdAt: '2024-05-05T08:00:00', link: '/app/billing',
    clientName: 'Desert Palm Hotel',
  },
  {
    id: 'n5', userId: 'tm1', type: 'package_limit', title: 'Package Limit Warning',
    message: 'FitZone Gym has consumed 11/12 videos this month. 1 video remaining.',
    isRead: true, createdAt: '2024-05-03T11:00:00', link: '/app/packages',
    clientName: 'FitZone Gym',
  },
  {
    id: 'n6', userId: 'tm1', type: 'task', title: 'Task Assigned to You',
    message: 'Layla Kamal assigned you: "Send May invoices to all active clients".',
    isRead: true, createdAt: '2024-05-01T10:00:00', link: '/app/tasks',
  },
]

export const seedActivity: ActivityItem[] = [
  {
    id: 'act1', userId: 'client1', userName: 'Farida Hassan', userColor: '#3B82F6',
    action: 'left 2 comments on', target: 'Summer Collection Launch Reel',
    targetType: 'video', createdAt: '2024-05-05T14:30:00', clientName: 'Nile Brands',
  },
  {
    id: 'act2', userId: 'tm3', userName: 'Omar Tarek', userColor: '#06B6D4',
    action: 'moved to Client Review', target: 'Summer Collection Launch Reel',
    targetType: 'video', createdAt: '2024-05-05T12:00:00', clientName: 'Nile Brands',
  },
  {
    id: 'act3', userId: 'client3', userName: 'Mona Khalil', userColor: '#8B5CF6',
    action: 'approved', target: 'AI Product Explainer — TechVision Pro',
    targetType: 'video', createdAt: '2024-05-04T09:00:00', clientName: 'TechVision',
  },
  {
    id: 'act4', userId: 'tm1', userName: 'Bassem Mahmoud', userColor: '#3B82F6',
    action: 'created invoice', target: 'CL-2024-0045 ($3,842)',
    targetType: 'invoice', createdAt: '2024-05-02T11:00:00', clientName: 'FitZone Gym',
  },
  {
    id: 'act5', userId: 'tm3', userName: 'Omar Tarek', userColor: '#06B6D4',
    action: 'uploaded final file for', target: 'April Transformation Stories',
    targetType: 'video', createdAt: '2024-05-02T10:30:00', clientName: 'FitZone Gym',
  },
  {
    id: 'act6', userId: 'client2', userName: 'Karim Nasser', userColor: '#F59E0B',
    action: 'requested revision on', target: 'New Branch Opening — Alexandria',
    targetType: 'video', createdAt: '2024-05-04T10:35:00', clientName: 'Cairo Eats',
  },
]

export const seedRevenueData = [
  { month: 'Dec', revenue: 14200, videos: 38 },
  { month: 'Jan', revenue: 16800, videos: 44 },
  { month: 'Feb', revenue: 15400, videos: 41 },
  { month: 'Mar', revenue: 18200, videos: 52 },
  { month: 'Apr', revenue: 21600, videos: 61 },
  { month: 'May', revenue: 21100, videos: 58 },
]

export const seedVideoStatusData = [
  { status: 'Posted', value: 28, color: '#10B981' },
  { status: 'Approved', value: 12, color: '#3B82F6' },
  { status: 'Editing', value: 10, color: '#8B5CF6' },
  { status: 'Review', value: 5, color: '#EAB308' },
  { status: 'Revision', value: 3, color: '#EF4444' },
]

export const seedPlatformData = [
  { platform: 'Instagram', value: 45, color: '#E1306C' },
  { platform: 'TikTok', value: 30, color: '#69C9D0' },
  { platform: 'YouTube', value: 15, color: '#FF0000' },
  { platform: 'LinkedIn', value: 7, color: '#0A66C2' },
  { platform: 'Facebook', value: 3, color: '#1877F2' },
]
