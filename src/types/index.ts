// Roles live in src/config/roles.ts — the single source of truth.
// Imported for use below and re-exported so existing
// `import type { UserRole } from '../types'` keeps working.
import type { UserRole, Permission } from '../config/roles'
export type { UserRole, Permission }

export type VideoStatus =
  | 'idea'
  | 'script'
  | 'shooting'
  | 'editing'
  | 'internal_review'
  | 'client_review'
  | 'revision'
  | 'approved'
  | 'scheduled'
  | 'posted'
  | 'archived'

export type VideoPlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin'
export type VideoFormat = 'reel' | 'short' | 'ad' | 'story' | 'longform' | 'podcast'
export type VideoAspect = '9:16' | '1:1' | '16:9'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  agencyId: string
  createdAt: string
}

export interface Agency {
  id: string
  name: string
  logo?: string
  plan: 'starter' | 'growth' | 'enterprise'
  createdAt: string
  ownerId: string
}

export interface Client {
  id: string
  agencyId: string
  name: string
  brandName: string
  industry: string
  contactName: string
  email: string
  phone: string
  packageId?: string
  status: 'active' | 'inactive' | 'paused'
  avatar?: string
  color: string
  socialLinks?: { instagram?: string; tiktok?: string; youtube?: string; facebook?: string; linkedin?: string }
  accountManagerId?: string
  portalAccess: boolean
  createdAt: string
  totalVideos?: number
  completedVideos?: number
}

export interface Project {
  id: string
  agencyId: string
  clientId: string
  clientName: string
  name: string
  type: string
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  startDate: string
  dueDate: string
  description?: string
  progress: number
  teamIds: string[]
}

export interface Video {
  id: string
  agencyId: string
  clientId: string
  clientName: string
  clientColor: string
  projectId?: string
  title: string
  status: VideoStatus
  platform: VideoPlatform
  format: VideoFormat
  assignedEditor?: string
  assignedEditorName?: string
  assignedScriptWriter?: string
  assignedSocialManager?: string
  dueDate: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  revisionCount: number
  approvalStatus: 'pending' | 'approved' | 'rejected'
  finalUrl?: string
  thumbnailUrl?: string
  caption?: string
  hashtags?: string[]
  script?: string
  hook?: string
  cta?: string
  version: number
  scheduledDate?: string
  postedUrl?: string
  notes?: string
  duration?: string
  aspectRatio?: VideoAspect
  createdAt: string
}

export interface Comment {
  id: string
  videoId: string
  userId: string
  userName: string
  userRole: UserRole
  timestamp?: number
  text: string
  status: 'open' | 'resolved'
  createdAt: string
  isInternal: boolean
  replies?: Comment[]
}

export interface Package {
  id: string
  clientId: string
  clientName: string
  name: string
  monthlyPrice: number
  includedVideos: number
  consumedVideos: number
  includedRevisions: number
  consumedRevisions: number
  includedShootingDays: number
  consumedShootingDays: number
  startDate: string
  renewalDate: string
  status: 'active' | 'expired' | 'cancelled'
  platforms: VideoPlatform[]
  extraVideoPrice: number
  extraRevisionPrice: number
  notes?: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string
  clientName: string
  amount: number
  tax: number
  discount: number
  total: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  dueDate: string
  issuedDate: string
  paidDate?: string
  notes?: string
  packageId?: string
}

export interface Asset {
  id: string
  clientId: string
  clientName: string
  type: 'logo' | 'color' | 'font' | 'intro' | 'music' | 'image' | 'video' | 'document' | 'other'
  name: string
  url?: string
  folder: string
  size?: string
  format?: string
  isApproved: boolean
  createdAt: string
  tags?: string[]
  thumbnail?: string
}

export interface Task {
  id: string
  title: string
  description?: string
  assignedTo: string
  assignedToName: string
  assignedToColor: string
  status: 'todo' | 'in_progress' | 'waiting' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate: string
  clientId?: string
  clientName?: string
  videoId?: string
  projectId?: string
  tags?: string[]
  createdAt: string
}

export interface Booking {
  id: string
  clientId: string
  clientName: string
  clientColor: string
  date: string
  time: string
  duration: string
  location: string
  studio?: string
  assignedTeam: string[]
  status:
    | 'requested'
    | 'confirmed'
    | 'deposit_paid'
    | 'scheduled'
    | 'completed'
    | 'cancelled'
    | 'rescheduled'
  shotList?: string[]
  notes?: string
  depositAmount?: number
  depositPaid: boolean
}

export interface TeamMember {
  id: string
  agencyId: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  color: string
  activeTasks: number
  completedThisWeek: number
  inProgressVideos: number
  availability: 'available' | 'busy' | 'off'
  clients: string[]
  joinedAt: string
}

export interface Notification {
  id: string
  userId: string
  type:
    | 'video_review'
    | 'revision_request'
    | 'approval'
    | 'invoice'
    | 'package_limit'
    | 'shooting'
    | 'comment'
    | 'task'
    | 'file'
    | 'scheduled'
    | 'posted'
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
  clientName?: string
}

export interface ActivityItem {
  id: string
  userId: string
  userName: string
  userColor: string
  action: string
  target: string
  targetType: 'video' | 'client' | 'invoice' | 'task' | 'project' | 'file' | 'booking'
  createdAt: string
  clientName?: string
}
