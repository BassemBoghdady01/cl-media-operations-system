/**
 * Videos & review comments — production service. No seed fallback.
 */
import { db, orThrow, dstr, type Row } from './serviceCore'
import { normalizeRole, ROLES } from '../config/roles'
import type { Video, Comment } from '../types'

const VIDEO_SELECT =
  '*, clients(name, color), editor:profiles!videos_assigned_editor_id_fkey(full_name)'

export function mapVideo(r: Row): Video {
  return {
    id: r.id,
    agencyId: r.agency_id,
    clientId: r.client_id,
    clientName: r.clients?.name ?? '',
    clientColor: r.clients?.color ?? '#3B82F6',
    projectId: r.project_id ?? undefined,
    title: r.title ?? '',
    status: r.status ?? 'idea',
    platform: r.platform ?? 'instagram',
    format: r.format ?? 'reel',
    assignedEditor: r.assigned_editor_id ?? undefined,
    assignedEditorName: r.editor?.full_name ?? undefined,
    dueDate: dstr(r.due_date),
    priority: r.priority ?? 'medium',
    revisionCount: Number(r.revision_count ?? 0),
    approvalStatus: r.approval_status ?? 'pending',
    finalUrl: r.final_file_url ?? undefined,
    thumbnailUrl: r.thumbnail_url ?? undefined,
    caption: r.caption ?? undefined,
    hashtags: r.hashtags ?? undefined,
    script: r.script ?? undefined,
    hook: r.hook ?? undefined,
    cta: r.cta ?? undefined,
    version: Number(r.version ?? 1),
    scheduledDate: r.scheduled_at ? String(r.scheduled_at) : undefined,
    postedUrl: r.published_url ?? undefined,
    notes: r.notes ?? undefined,
    duration: r.duration ?? undefined,
    aspectRatio: r.aspect_ratio ?? undefined,
    createdAt: dstr(r.created_at),
  }
}

function mapComment(r: Row): Comment {
  return {
    id: r.id,
    videoId: r.video_id,
    userId: r.user_id,
    userName: r.profiles?.full_name ?? 'Team member',
    userRole: normalizeRole(r.profiles?.role) ?? ROLES.VIEWER,
    timestamp: r.timestamp_seconds != null ? Number(r.timestamp_seconds) : undefined,
    text: r.comment ?? '',
    status: r.status ?? 'open',
    createdAt: String(r.created_at ?? ''),
    isInternal: !!r.is_internal,
  }
}

export const videoService = {
  getAll: async (agencyId: string): Promise<Video[]> => {
    const { data, error } = await db()
      .from('videos').select(VIDEO_SELECT)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
    orThrow('videoService.getAll', error)
    return (data ?? []).map(mapVideo)
  },

  getById: async (id: string): Promise<Video | undefined> => {
    const { data, error } = await db()
      .from('videos').select(VIDEO_SELECT).eq('id', id).maybeSingle()
    orThrow('videoService.getById', error)
    return data ? mapVideo(data) : undefined
  },

  getByClient: async (clientId: string): Promise<Video[]> => {
    const { data, error } = await db()
      .from('videos').select(VIDEO_SELECT)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    orThrow('videoService.getByClient', error)
    return (data ?? []).map(mapVideo)
  },

  updateStatus: async (id: string, status: Video['status']): Promise<void> => {
    const { error } = await db().from('videos').update({ status }).eq('id', id)
    orThrow('videoService.updateStatus', error)
  },

  create: async (agencyId: string, video: Partial<Video>): Promise<Video> => {
    const { data, error } = await db()
      .from('videos')
      .insert({
        agency_id: agencyId,
        client_id: video.clientId,
        project_id: video.projectId ?? null,
        title: video.title,
        platform: video.platform,
        format: video.format,
        status: video.status ?? 'idea',
        priority: video.priority ?? 'medium',
        due_date: video.dueDate || null,
        assigned_editor_id: video.assignedEditor ?? null,
        hook: video.hook,
        script: video.script,
        caption: video.caption,
        hashtags: video.hashtags,
        cta: video.cta,
        notes: video.notes,
        aspect_ratio: video.aspectRatio,
        duration: video.duration,
      })
      .select(VIDEO_SELECT).single()
    orThrow('videoService.create', error)
    return mapVideo(data as Row)
  },

  update: async (id: string, updates: Partial<Video>): Promise<void> => {
    const patch: Row = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.priority !== undefined) patch.priority = updates.priority
    if (updates.dueDate !== undefined) patch.due_date = updates.dueDate || null
    if (updates.assignedEditor !== undefined) patch.assigned_editor_id = updates.assignedEditor
    if (updates.approvalStatus !== undefined) patch.approval_status = updates.approvalStatus
    if (updates.revisionCount !== undefined) patch.revision_count = updates.revisionCount
    if (updates.hook !== undefined) patch.hook = updates.hook
    if (updates.script !== undefined) patch.script = updates.script
    if (updates.caption !== undefined) patch.caption = updates.caption
    if (updates.hashtags !== undefined) patch.hashtags = updates.hashtags
    if (updates.cta !== undefined) patch.cta = updates.cta
    if (updates.notes !== undefined) patch.notes = updates.notes
    if (updates.scheduledDate !== undefined) patch.scheduled_at = updates.scheduledDate || null
    if (updates.postedUrl !== undefined) patch.published_url = updates.postedUrl
    if (updates.finalUrl !== undefined) patch.final_file_url = updates.finalUrl
    if (updates.thumbnailUrl !== undefined) patch.thumbnail_url = updates.thumbnailUrl
    const { error } = await db().from('videos').update(patch).eq('id', id)
    orThrow('videoService.update', error)
  },

  getComments: async (videoId: string): Promise<Comment[]> => {
    const { data, error } = await db()
      .from('review_comments')
      .select('*, profiles(full_name, role)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true })
    orThrow('videoService.getComments', error)
    return (data ?? []).map(mapComment)
  },

  addComment: async (comment: {
    agencyId: string
    videoId: string
    userId: string
    text: string
    timestamp?: number
    isInternal?: boolean
  }): Promise<Comment> => {
    const { data, error } = await db()
      .from('review_comments')
      .insert({
        agency_id: comment.agencyId,
        video_id: comment.videoId,
        user_id: comment.userId,
        comment: comment.text,
        timestamp_seconds: comment.timestamp ?? null,
        is_internal: comment.isInternal ?? false,
      })
      .select('*, profiles(full_name, role)').single()
    orThrow('videoService.addComment', error)
    return mapComment(data as Row)
  },
}
