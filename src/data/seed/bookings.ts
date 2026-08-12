import type { Booking } from '../../types'

export const seedBookings: Booking[] = [
  {
    id: 'b1', clientId: 'c1', clientName: 'Nile Brands Co.', clientColor: '#3B82F6',
    date: '2024-05-10', time: '10:00', duration: '4h', location: 'EZ Marketing Studio — Maadi',
    studio: 'Studio A', assignedTeam: ['tm3', 'tm4'], status: 'confirmed',
    shotList: ['Product flat lays', 'Model outfits x3', 'Lifestyle shots', 'BTS moments'],
    depositAmount: 1000, depositPaid: true,
    notes: 'Client bringing 3 models and clothing rack.',
  },
  {
    id: 'b2', clientId: 'c4', clientName: 'Desert Palm Hotel', clientColor: '#10B981',
    date: '2024-05-14', time: '08:00', duration: '6h', location: 'Desert Palm — New Cairo',
    studio: 'On Location', assignedTeam: ['tm3'], status: 'deposit_paid',
    shotList: ['Pool area', 'Spa interiors', 'Restaurant dinner setup', 'Sunset aerial (drone)'],
    depositAmount: 1500, depositPaid: true,
  },
]
