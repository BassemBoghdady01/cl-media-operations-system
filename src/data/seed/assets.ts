import type { Asset } from '../../types'

export const seedAssets: Asset[] = [
  {
    id: 'as1', clientId: 'c1', clientName: 'Nile Brands', type: 'logo', name: 'Nile Brands Logo — Main',
    folder: 'Logos', format: 'SVG', size: '45 KB', isApproved: true,
    createdAt: '2024-01-15', tags: ['logo', 'primary'],
  },
  {
    id: 'as2', clientId: 'c1', clientName: 'Nile Brands', type: 'image', name: 'Brand Color Palette',
    folder: 'Brand Guidelines', format: 'PNG', size: '220 KB', isApproved: true,
    createdAt: '2024-01-15', tags: ['colors', 'brand'],
  },
  {
    id: 'as3', clientId: 'c1', clientName: 'Nile Brands', type: 'video', name: 'Brand Intro 3s',
    folder: 'Intros & Outros', format: 'MP4', size: '8.2 MB', isApproved: true,
    createdAt: '2024-02-01', tags: ['intro', 'animated'],
  },
  {
    id: 'as4', clientId: 'c2', clientName: 'Cairo Eats', type: 'logo', name: 'Cairo Eats Logo — White',
    folder: 'Logos', format: 'PNG', size: '180 KB', isApproved: true,
    createdAt: '2024-02-20', tags: ['logo', 'white'],
  },
  {
    id: 'as5', clientId: 'c2', clientName: 'Cairo Eats', type: 'music', name: 'Upbeat Brand Track',
    folder: 'Music & Sound', format: 'MP3', size: '3.4 MB', isApproved: true,
    createdAt: '2024-03-05', tags: ['music', 'brand'],
  },
  {
    id: 'as6', clientId: 'c3', clientName: 'TechVision', type: 'document', name: 'Brand Voice Guide',
    folder: 'Brand Guidelines', format: 'PDF', size: '1.2 MB', isApproved: true,
    createdAt: '2024-01-08', tags: ['guidelines', 'voice'],
  },
  {
    id: 'as7', clientId: 'c5', clientName: 'FitZone Gym', type: 'video', name: 'Brand Outro 5s',
    folder: 'Intros & Outros', format: 'MP4', size: '12.5 MB', isApproved: true,
    createdAt: '2024-02-15', tags: ['outro', 'animated'],
  },
  {
    id: 'as8', clientId: 'c1', clientName: 'Nile Brands', type: 'image', name: 'Summer Campaign Raw Photos',
    folder: 'Campaigns/Summer 2024', format: 'ZIP', size: '245 MB', isApproved: false,
    createdAt: '2024-05-01', tags: ['raw', 'summer'],
  },
]
