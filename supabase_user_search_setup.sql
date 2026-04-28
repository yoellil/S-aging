-- ════════════════════════════════════════════════════════════════
-- S-Aging User Search — allow authenticated users to find others
-- Run this in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Allow any signed-in user to read public profile fields of all users
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow any signed-in user to see how many simulations another user has run
DROP POLICY IF EXISTS "Authenticated users can read simulation counts" ON public.simulation_logs;
CREATE POLICY "Authenticated users can read simulation counts"
  ON public.simulation_logs FOR SELECT
  TO authenticated
  USING (true);
