import type { Client } from '../../../types'

export const seedClients: Client[] = [
  {
    id: 'c1', agencyId: 'a1', name: 'Nile Brands Co.', brandName: 'Nile Brands',
    industry: 'Fashion & Lifestyle', contactName: 'Farida Hassan', email: 'farida@nilebrands.com',
    phone: '+20 100 123 4567', packageId: 'p1', status: 'active', color: '#3B82F6',
    socialLinks: { instagram: '@nilebrands', tiktok: '@nilebrands_official' },
    accountManagerId: 'tm1', portalAccess: true, createdAt: '2024-01-15',
    totalVideos: 48, completedVideos: 41,
  },
  {
    id: 'c2', agencyId: 'a1', name: 'Cairo Eats', brandName: 'Cairo Eats',
    industry: 'Food & Beverage', contactName: 'Karim Nasser', email: 'karim@cairoeats.com',
    phone: '+20 112 987 6543', packageId: 'p2', status: 'active', color: '#F59E0B',
    socialLinks: { instagram: '@cairo.eats', tiktok: '@cairoeats' },
    accountManagerId: 'tm1', portalAccess: true, createdAt: '2024-02-20',
    totalVideos: 32, completedVideos: 28,
  },
  {
    id: 'c3', agencyId: 'a1', name: 'TechVision Egypt', brandName: 'TechVision',
    industry: 'Technology', contactName: 'Mona Khalil', email: 'mona@techvision.eg',
    phone: '+20 122 456 7890', packageId: 'p3', status: 'active', color: '#8B5CF6',
    socialLinks: { instagram: '@techvision_eg', youtube: 'TechVisionEgypt' },
    accountManagerId: 'tm2', portalAccess: true, createdAt: '2024-01-08',
    totalVideos: 60, completedVideos: 52,
  },
  {
    id: 'c4', agencyId: 'a1', name: 'Desert Palm Hotel', brandName: 'Desert Palm',
    industry: 'Hospitality', contactName: 'Ahmed Al-Rashid', email: 'ahmed@desertpalm.com',
    phone: '+20 100 111 2222', packageId: 'p4', status: 'active', color: '#10B981',
    socialLinks: { instagram: '@desertpalmhotel', facebook: 'DesertPalmHotel' },
    accountManagerId: 'tm2', portalAccess: false, createdAt: '2024-03-05',
    totalVideos: 20, completedVideos: 16,
  },
  {
    id: 'c5', agencyId: 'a1', name: 'FitZone Gym', brandName: 'FitZone',
    industry: 'Health & Fitness', contactName: 'Sara Ali', email: 'sara@fitzone.com',
    phone: '+20 115 333 4444', packageId: 'p5', status: 'active', color: '#EF4444',
    socialLinks: { instagram: '@fitzone_eg', tiktok: '@fitzone_official' },
    accountManagerId: 'tm1', portalAccess: true, createdAt: '2024-02-01',
    totalVideos: 44, completedVideos: 37,
  },
  {
    id: 'c6', agencyId: 'a1', name: 'StyleHub Fashion', brandName: 'StyleHub',
    industry: 'Fashion & Retail', contactName: 'Layla Mansour', email: 'layla@stylehub.com',
    phone: '+20 109 555 6666', packageId: 'p6', status: 'paused', color: '#EC4899',
    socialLinks: { instagram: '@stylehub.eg', tiktok: '@stylehub_fashion' },
    accountManagerId: 'tm1', portalAccess: true, createdAt: '2023-11-15',
    totalVideos: 36, completedVideos: 36,
  },
]
