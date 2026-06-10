/**
 * CL — Storage Service
 *
 * Handles file uploads to Supabase Storage.
 * All functions gracefully handle missing Supabase config (seed mode).
 *
 * Bucket path convention: {agency_id}/{client_id}/{filename}
 */

import { supabase, isSupabaseReady } from '../lib/supabase'
import { APP_CONFIG } from '../config/app'

type UploadResult = { url: string; path: string }

async function upload(
  bucket: string,
  path: string,
  file: File,
): Promise<UploadResult> {
  if (!isSupabaseReady || !supabase) {
    throw new Error(
      'Storage not available in seed mode. Connect Supabase to enable file uploads.'
    )
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return { url: urlData.publicUrl, path: data.path }
}

async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
  if (!isSupabaseReady || !supabase) throw new Error('Storage not configured')

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) throw error
  return data.signedUrl
}

async function deleteFile(bucket: string, path: string): Promise<void> {
  if (!isSupabaseReady || !supabase) throw new Error('Storage not configured')

  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
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
      `${agencyId}/${clientId}/${videoId}/final-${file.name}`,
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
  deleteFile,
}
