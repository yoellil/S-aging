-- ════════════════════════════════════════════════════════════════
-- Allow authenticated users to read simulation logs of public profiles
-- Run this in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Let any signed-in user read logs where the owner's profile is public
CREATE POLICY "Read public simulation logs"
  ON public.simulation_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = simulation_logs.user_id
        AND profiles.is_public = true
    )
    OR auth.uid() = user_id
  );

-- Let any signed-in user read all profiles (for search + public profile view)
CREATE POLICY "Read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
