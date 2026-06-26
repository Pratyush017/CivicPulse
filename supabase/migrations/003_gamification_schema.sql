-- ============================================================================
-- CivicPulse — Gamification & Profiles Migration
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. profiles table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  civic_points INTEGER NOT NULL DEFAULT 0,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read profiles
CREATE POLICY "Anyone can read profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- --------------------------------------------------------------------------
-- 2. Trigger to create profile on signup
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, avatar_url, civic_points)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'avatar_url',
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------------
-- 3. RPC Function: Increment Civic Points
-- --------------------------------------------------------------------------
-- This function allows securely incrementing a user's civic points
-- from the API route (which will use the Supabase Anon key or Service key)
CREATE OR REPLACE FUNCTION public.increment_civic_points(user_id_param UUID, amount INT)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, civic_points, updated_at)
  VALUES (user_id_param, amount, now())
  ON CONFLICT (id) DO UPDATE
  SET civic_points = public.profiles.civic_points + amount,
      updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
