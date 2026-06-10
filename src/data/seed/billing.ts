import type { Package, Invoice } from '../../types'

export const seedPackages: Package[] = [
  {
    id: 'p1', clientId: 'c1', clientName: 'Nile Brands Co.', name: 'Content Machine — 12',
    monthlyPrice: 4500, includedVideos: 12, consumedVideos: 10, includedRevisions: 24,
    consumedRevisions: 18, includedShootingDays: 2, consumedShootingDays: 2,
    startDate: '2024-05-01', renewalDate: '2024-06-01', status: 'active',
    platforms: ['instagram', 'tiktok'], extraVideoPrice: 450, extraRevisionPrice: 80,
  },
  {
    id: 'p2', clientId: 'c2', clientName: 'Cairo Eats', name: 'Starter — 8 Reels',
    monthlyPrice: 2800, includedVideos: 8, consumedVideos: 7, includedRevisions: 16,
    consumedRevisions: 10, includedShootingDays: 1, consumedShootingDays: 1,
    startDate: '2024-05-01', renewalDate: '2024-06-01', status: 'active',
    platforms: ['instagram'], extraVideoPrice: 400, extraRevisionPrice: 70,
  },
  {
    id: 'p3', clientId: 'c3', clientName: 'TechVision Egypt', name: 'Enterprise — 20 Videos',
    monthlyPrice: 7200, includedVideos: 20, consumedVideos: 12, includedRevisions: 40,
    consumedRevisions: 14, includedShootingDays: 3, consumedShootingDays: 1,
    startDate: '2024-05-01', renewalDate: '2024-06-01', status: 'active',
    platforms: ['instagram', 'youtube', 'linkedin'], extraVideoPrice: 420, extraRevisionPrice: 60,
  },
  {
    id: 'p4', clientId: 'c4', clientName: 'Desert Palm Hotel', name: 'Starter — 8 Reels',
    monthlyPrice: 2800, includedVideos: 8, consumedVideos: 4, includedRevisions: 16,
    consumedRevisions: 5, includedShootingDays: 1, consumedShootingDays: 0,
    startDate: '2024-05-01', renewalDate: '2024-06-01', status: 'active',
    platforms: ['instagram', 'facebook'], extraVideoPrice: 400, extraRevisionPrice: 70,
  },
  {
    id: 'p5', clientId: 'c5', clientName: 'FitZone Gym', name: 'Content Machine — 12',
    monthlyPrice: 3800, includedVideos: 12, consumedVideos: 11, includedRevisions: 24,
    consumedRevisions: 22, includedShootingDays: 2, consumedShootingDays: 2,
    startDate: '2024-05-01', renewalDate: '2024-06-01', status: 'active',
    platforms: ['instagram', 'tiktok'], extraVideoPrice: 380, extraRevisionPrice: 65,
  },
]

export const seedInvoices: Invoice[] = [
  {
    id: 'inv1', invoiceNumber: 'CL-2024-0041', clientId: 'c1', clientName: 'Nile Brands Co.',
    amount: 4500, tax: 405, discount: 0, total: 4905, status: 'paid',
    dueDate: '2024-05-01', issuedDate: '2024-04-25', paidDate: '2024-04-28',
  },
  {
    id: 'inv2', invoiceNumber: 'CL-2024-0042', clientId: 'c2', clientName: 'Cairo Eats',
    amount: 2800, tax: 252, discount: 200, total: 2852, status: 'paid',
    dueDate: '2024-05-01', issuedDate: '2024-04-25', paidDate: '2024-04-30',
  },
  {
    id: 'inv3', invoiceNumber: 'CL-2024-0043', clientId: 'c3', clientName: 'TechVision Egypt',
    amount: 7200, tax: 648, discount: 0, total: 7848, status: 'sent',
    dueDate: '2024-05-10', issuedDate: '2024-05-01',
  },
  {
    id: 'inv4', invoiceNumber: 'CL-2024-0044', clientId: 'c4', clientName: 'Desert Palm Hotel',
    amount: 2800, tax: 252, discount: 0, total: 3052, status: 'overdue',
    dueDate: '2024-05-01', issuedDate: '2024-04-24',
    notes: 'Second reminder sent on May 3rd.',
  },
  {
    id: 'inv5', invoiceNumber: 'CL-2024-0045', clientId: 'c5', clientName: 'FitZone Gym',
    amount: 3800, tax: 342, discount: 300, total: 3842, status: 'sent',
    dueDate: '2024-05-12', issuedDate: '2024-05-02',
  },
  {
    id: 'inv6', invoiceNumber: 'CL-2024-0040', clientId: 'c1', clientName: 'Nile Brands Co.',
    amount: 4500, tax: 405, discount: 0, total: 4905, status: 'paid',
    dueDate: '2024-04-01', issuedDate: '2024-03-25', paidDate: '2024-03-31',
  },
]
