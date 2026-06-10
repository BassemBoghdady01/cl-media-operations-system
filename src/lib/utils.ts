import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function timeAgo(dateStr: string) {
  const now = new Date()
  const past = new Date(dateStr)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateShort(dateStr)
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str: string, length = 40) {
  return str.length > length ? str.slice(0, length) + '…' : str
}

export const platformColors: Record<string, string> = {
  instagram: '#E1306C',
  tiktok: '#69C9D0',
  youtube: '#FF0000',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
}

export const platformLabels: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

export const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  idea: { bg: 'rgba(100,116,139,0.2)', text: '#94A3B8', dot: '#64748B' },
  script: { bg: 'rgba(139,92,246,0.15)', text: '#A78BFA', dot: '#8B5CF6' },
  shooting: { bg: 'rgba(245,158,11,0.15)', text: '#FCD34D', dot: '#F59E0B' },
  editing: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA', dot: '#3B82F6' },
  internal_review: { bg: 'rgba(6,182,212,0.15)', text: '#22D3EE', dot: '#06B6D4' },
  client_review: { bg: 'rgba(234,179,8,0.15)', text: '#FDE047', dot: '#EAB308' },
  revision: { bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5', dot: '#EF4444' },
  approved: { bg: 'rgba(16,185,129,0.15)', text: '#6EE7B7', dot: '#10B981' },
  scheduled: { bg: 'rgba(139,92,246,0.15)', text: '#C4B5FD', dot: '#8B5CF6' },
  posted: { bg: 'rgba(16,185,129,0.2)', text: '#34D399', dot: '#10B981' },
  archived: { bg: 'rgba(71,85,105,0.2)', text: '#94A3B8', dot: '#475569' },
  active: { bg: 'rgba(16,185,129,0.15)', text: '#6EE7B7', dot: '#10B981' },
  inactive: { bg: 'rgba(71,85,105,0.2)', text: '#94A3B8', dot: '#475569' },
  paused: { bg: 'rgba(245,158,11,0.15)', text: '#FCD34D', dot: '#F59E0B' },
  todo: { bg: 'rgba(100,116,139,0.2)', text: '#94A3B8', dot: '#64748B' },
  in_progress: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA', dot: '#3B82F6' },
  waiting: { bg: 'rgba(245,158,11,0.15)', text: '#FCD34D', dot: '#F59E0B' },
  done: { bg: 'rgba(16,185,129,0.15)', text: '#6EE7B7', dot: '#10B981' },
  blocked: { bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5', dot: '#EF4444' },
  draft: { bg: 'rgba(100,116,139,0.2)', text: '#94A3B8', dot: '#64748B' },
  sent: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA', dot: '#3B82F6' },
  paid: { bg: 'rgba(16,185,129,0.15)', text: '#6EE7B7', dot: '#10B981' },
  overdue: { bg: 'rgba(239,68,68,0.15)', text: '#FCA5A5', dot: '#EF4444' },
  cancelled: { bg: 'rgba(71,85,105,0.2)', text: '#94A3B8', dot: '#475569' },
}

export const priorityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: 'rgba(71,85,105,0.2)', text: '#94A3B8' },
  medium: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
  high: { bg: 'rgba(245,158,11,0.15)', text: '#FCD34D' },
  urgent: { bg: 'rgba(239,68,68,0.2)', text: '#FCA5A5' },
}
