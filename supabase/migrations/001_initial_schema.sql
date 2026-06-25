-- ============================================================================
-- Community Hero — Initial Schema Migration
-- Run this in the Supabase SQL Editor (or via the Supabase CLI).
-- ============================================================================

-- Enable the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- 1. Storage bucket for issue images
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue_images', 'issue_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read images (public bucket)
CREATE POLICY "Public read access for issue_images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'issue_images');

-- Allow authenticated and anonymous uploads (adjust to your auth model)
CREATE POLICY "Allow uploads to issue_images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'issue_images');

-- --------------------------------------------------------------------------
-- 2. reports table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  category      TEXT        NOT NULL,
  severity_score INTEGER   NOT NULL CHECK (severity_score BETWEEN 1 AND 5),
  latitude      NUMERIC    NOT NULL,
  longitude     NUMERIC    NOT NULL,
  image_url     TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'Reported',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for geospatial-style lookups and common filters
CREATE INDEX idx_reports_location ON public.reports (latitude, longitude);
CREATE INDEX idx_reports_status   ON public.reports (status);
CREATE INDEX idx_reports_created  ON public.reports (created_at DESC);

-- --------------------------------------------------------------------------
-- 3. verifications table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verifications (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID    NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id         TEXT    NOT NULL,
  verified_status BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate verifications from the same user on the same report
CREATE UNIQUE INDEX idx_verifications_unique
  ON public.verifications (report_id, user_id);

-- --------------------------------------------------------------------------
-- 4. Row Level Security (RLS)
-- --------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Open read access for reports (public feed)
CREATE POLICY "Anyone can read reports"
  ON public.reports FOR SELECT
  USING (true);

-- Allow inserts from any connection (adjust for auth later)
CREATE POLICY "Anyone can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (true);

-- Open read access for verifications
CREATE POLICY "Anyone can read verifications"
  ON public.verifications FOR SELECT
  USING (true);

-- Allow inserts for verifications
CREATE POLICY "Anyone can create verifications"
  ON public.verifications FOR INSERT
  WITH CHECK (true);
