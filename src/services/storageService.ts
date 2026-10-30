/**
 * EZ Marketing Agency — Storage Service
 *
 * Handles file uploads to Supabase Storage.
 *
 * Bucket path convention: {agency_id}/{client_id}/{filename}
 *
 * PRIVATE vs PUBLIC buckets
 *   Only `thumbnails` is public. Every other bucket (client-assets,
 *   raw-footage, video-versions, final-deliveries, invoices,
 *   finance-attachments) is PRIVATE, so `getPublicUrl()` links to them 404.
 *   For private buckets the upload result's `url` is the STORAGE PATH — that is
 *   what gets persisted in the DB — and files are opened via a short-lived
 *   signed URL (`signedUrlFor` / `openStoredFile`).
 *
 *   Older rows may hold a full `…/object/public/<bucket>/<path>` URL;
 *   `pathFromStored()` derives the storage path from those so they still work.
 */

import { supabase, isSupabaseReady } from '../lib/supabase'
import { APP_CONFIG } from '../config/app'

/**
 * `path` — the object path inside the bucket.
 * `url`  — what to persist: the public URL for public buckets, otherwise the
 *          storage path (resolve it with `signedUrlFor` before linking to it).
 */
type UploadResult = { url: string; path: string }

const PUBLIC_BUCKETS = new Set<string>([APP_CONFIG.storage.thumbnails])

/** Signed URLs handed to users last one hour. */
export const SIGNED_URL_TTL_SECONDS = 3600

function client() {
  if (!isSupabaseReady || !supabase) {
    throw new Error('Storage is not configured. Connect Supabase to enable files.')
  }
  return supabase
}

async function upload(
  bucket: string,
  path: string,
  file: File,
): Promise<UploadResult> {
  const sb = client()
  const { data, error } = await sb.storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (error) throw error

  if (PUBLIC_BUCKETS.has(bucket)) {
    const { data: urlData } = sb.storage.from(bucket).getPublicUrl(data.path)
    return { url: urlData.publicUrl, path: data.path }
  }
  return { url: data.path, path: data.path }
}

/**
 * Storage path for a stored value: either a bare path, or a legacy Supabase
 * storage URL (`/object/public/<bucket>/…`, `/object/sign/<bucket>/…`,
 * `/object/authenticated/<bucket>/…`). Returns null for unrelated URLs.
 */
export function pathFromStored(bucket: string, stored: string | null | undefined): string | null {
  if (!stored) return null
  const value = stored.trim()
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '')

  for (const kind of ['public', 'sign', 'authenticated']) {
    const marker = `/object/${kind}/${bucket}/`
    const idx = value.indexOf(marker)
    if (idx >= 0) {
      const rest = value.slice(idx + marker.length).split(/[?#]/)[0]
      try { return decodeURIComponent(rest) } catch { return rest }
    }
  }
  return null
}

async function getSignedUrl(bucket: string, path: string, expiresIn = SIGNED_URL_TTL_SECONDS): Promise<string> {
  const { data, error } = await client().storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) throw error
  return data.signedUrl
}

/**
 * A URL the browser can open for a stored value. Private-bucket paths (and
 * legacy public URLs into private buckets) become 1-hour signed URLs; any
 * external URL that isn't in this bucket is returned unchanged.
 */
async function signedUrlFor(bucket: string, stored: string | null | undefined, expiresIn = SIGNED_URL_TTL_SECONDS): Promise<string> {
  if (!stored) throw new Error('This record has no file attached.')
  const path = pathFromStored(bucket, stored)
  if (!path) return stored // external link (e.g. Drive) — open as-is
  if (PUBLIC_BUCKETS.has(bucket)) {
    return client().storage.from(bucket).getPublicUrl(path).data.publicUrl
  }
  return getSignedUrl(bucket, path, expiresIn)
}

/**
 * Opens a stored file in a new tab. The tab is opened synchronously (inside
 * the click) so popup blockers allow it, then pointed at the signed URL.
 */
async function openStoredFile(bucket: string, stored: string | null | undefined): Promise<void> {
  const win = window.open('', '_blank')
  try {
    const url = await signedUrlFor(bucket, stored)
    if (win) {
      win.opener = null
      win.location.href = url
    } else {
      window.location.assign(url)
    }
  } catch (err) {
    win?.close()
    throw err
  }
}

async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await client().storage.from(bucket).remove([path])
  if (error) throw error
}

/** Removes the object behind a stored value; no-op for external URLs. */
async function deleteStored(bucket: string, stored: string | null | undefined): Promise<void> {
  const path = pathFromStored(bucket, stored)
  if (!path) return
  await deleteFile(bucket, path)
}

export const storageService = {
  uploadClientAsset: (agencyId: string, clientId: string, file: File) =>
    upload(
      APP_CONFIG.storage.clientAssets,
      `${agencyId}/${clientId}/${Date.now()}-${file.name}`,
      file
    ),

  uploadVideoVersion: (agencyId: string, clientId: string, videoId: string, version: number, file: File) =>
    upload(
      APP_CONFIG.storage.videoVersions,
      `${agencyId}/${clientId}/${videoId}/v${version}-${file.name}`,
      file
    ),

  uploadFinalDelivery: (agencyId: string, clientId: string, videoId: string, file: File) =>
    upload(
      APP_CONFIG.storage.finalDeliveries,
      `${agencyId}/${clientId}/${videoId}/final-${Date.now()}-${file.name}`,
      file
    ),

  uploadThumbnail: (agencyId: string, videoId: string, file: File) =>
    upload(
      APP_CONFIG.storage.thumbnails,
      `${agencyId}/${videoId}-thumb.${file.name.split('.').pop()}`,
      file
    ),

  uploadInvoiceFile: (agencyId: string, clientId: string, invoiceNumber: string, file: File) =>
    upload(
      APP_CONFIG.storage.invoices,
      `${agencyId}/${clientId}/${invoiceNumber}.pdf`,
      file
    ),

  getSignedUrl,
  signedUrlFor,
  openStoredFile,
  pathFromStored,
  deleteFile,
  deleteStored,
}
