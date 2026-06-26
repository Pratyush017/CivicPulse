-- ============================================================================
-- CivicPulse — Fix Delete Policy
-- Run this in the Supabase SQL Editor to allow users to delete their reports.
-- ============================================================================

-- Allow users to delete their own reports, or allow any logged-in user to delete 
-- anonymous "seed" reports (where user_id IS NULL).
CREATE POLICY "Users can delete own reports"
  ON public.reports FOR DELETE
  USING (auth.uid() = user_id OR user_id IS NULL);
