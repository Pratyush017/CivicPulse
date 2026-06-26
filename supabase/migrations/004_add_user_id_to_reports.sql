-- ============================================================================
-- CivicPulse — Add user_id to reports
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- Add user_id column referencing auth.users
ALTER TABLE public.reports 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update RLS policies to allow users to update their own reports
-- (We already added "Anyone can update reports" in 002, but this is a good
-- foundational column for future user-specific filtering).
