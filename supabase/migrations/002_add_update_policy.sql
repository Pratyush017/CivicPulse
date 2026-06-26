-- Allow anonymous users to update the reports table (e.g., to mark as Resolved)
CREATE POLICY "Anyone can update reports"
  ON public.reports FOR UPDATE
  USING (true)
  WITH CHECK (true);
