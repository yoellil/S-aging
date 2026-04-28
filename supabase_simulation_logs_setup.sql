-- ════════════════════════════════════════════════════════════════
-- S-Aging Simulation Logs Table (v2 — includes image + detection data)
-- Run this in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.simulation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disease TEXT NOT NULL,
  temp NUMERIC,
  rh NUMERIC,
  density TEXT,
  final_infected_pct NUMERIC,
  final_necrotic_pct NUMERIC,
  final_healthy_pct NUMERIC,
  months_simulated INTEGER,
  image_url TEXT,
  detections JSONB,
  mask_grid JSONB,
  img_width INTEGER,
  img_height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if table already existed
ALTER TABLE public.simulation_logs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.simulation_logs ADD COLUMN IF NOT EXISTS detections JSONB;
ALTER TABLE public.simulation_logs ADD COLUMN IF NOT EXISTS mask_grid JSONB;
ALTER TABLE public.simulation_logs ADD COLUMN IF NOT EXISTS img_width INTEGER;
ALTER TABLE public.simulation_logs ADD COLUMN IF NOT EXISTS img_height INTEGER;

ALTER TABLE public.simulation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own simulation logs" ON public.simulation_logs;
DROP POLICY IF EXISTS "Users can insert own simulation logs" ON public.simulation_logs;

CREATE POLICY "Users can read own simulation logs"
  ON public.simulation_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own simulation logs"
  ON public.simulation_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── Simulation images bucket ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('simulation-images', 'simulation-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Simulation images public read" ON storage.objects;
DROP POLICY IF EXISTS "Simulation images upload" ON storage.objects;

CREATE POLICY "Simulation images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'simulation-images');

CREATE POLICY "Simulation images upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'simulation-images');
