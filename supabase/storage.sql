-- ============================================================
-- EZ Marketing Agency — Supabase Storage Buckets & Policies
-- Run AFTER schema.sql and rls-policies.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Create Buckets
-- ─────────────────────────────────────────────────────────────

-- Client brand assets (logos, colors, fonts, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-assets',
  'client-assets',
  false,
  52428800, -- 50MB
  ARRAY['image/jpeg','image/png','image/svg+xml','image/webp','application/pdf','application/zip','audio/mpeg','video/mp4']
) ON CONFLICT (id) DO NOTHING;

-- Raw footage uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'raw-footage',
  'raw-footage',
  false,
  5368709120, -- 5GB
  ARRAY['video/mp4','video/quicktime','video/x-msvideo','video/x-matroska']
) ON CONFLICT (id) DO NOTHING;

-- Video versions (review copies)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-versions',
  'video-versions',
  false,
  2147483648, -- 2GB
  ARRAY['video/mp4','video/quicktime','video/webm']
) ON CONFLICT (id) DO NOTHING;

-- Final delivery files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'final-deliveries',
  'final-deliveries',
  false,
  2147483648, -- 2GB
  ARRAY['video/mp4','video/quicktime','application/zip']
) ON CONFLICT (id) DO NOTHING;

-- Thumbnails (publicly accessible for previews)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Invoice PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Storage Policies — client-assets
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal team can manage client assets"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'client-assets'
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('client')
  );

CREATE POLICY "Clients can view their own assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-assets'
    AND auth.role() = 'authenticated'
    -- Path pattern: {agency_id}/{client_id}/...
    AND SPLIT_PART(name, '/', 2) IN (
      SELECT id::text FROM clients WHERE portal_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Storage Policies — raw-footage
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal team can manage raw footage"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'raw-footage'
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('client')
  );

-- ─────────────────────────────────────────────────────────────
-- Storage Policies — video-versions
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal team can manage video versions"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'video-versions'
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('client')
  );

CREATE POLICY "Clients can view their video versions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'video-versions'
    AND auth.role() = 'authenticated'
    AND SPLIT_PART(name, '/', 2) IN (
      SELECT id::text FROM clients WHERE portal_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Storage Policies — final-deliveries
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal team can manage final deliveries"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'final-deliveries'
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('client')
  );

CREATE POLICY "Clients can download their final deliveries"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'final-deliveries'
    AND auth.role() = 'authenticated'
    AND SPLIT_PART(name, '/', 2) IN (
      SELECT id::text FROM clients WHERE portal_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Storage Policies — thumbnails (public bucket, no extra policy needed)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Anyone can view thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');

CREATE POLICY "Internal team can upload thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('client')
  );

-- ─────────────────────────────────────────────────────────────
-- Storage Policies — invoices
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Internal team can manage invoices"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'invoices'
    AND auth.role() = 'authenticated'
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner', 'admin', 'accountant')
  );

CREATE POLICY "Clients can view their own invoices"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices'
    AND auth.role() = 'authenticated'
    AND SPLIT_PART(name, '/', 2) IN (
      SELECT id::text FROM clients WHERE portal_user_id = auth.uid()
    )
  );
