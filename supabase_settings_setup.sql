-- ════════════════════════════════════════════════════════════════
-- S-Aging User Settings — privacy, sim defaults, theme
-- Run this in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_disease TEXT DEFAULT 'black_sigatoka';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_temp NUMERIC DEFAULT 26;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_rh NUMERIC DEFAULT 85;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_density TEXT DEFAULT 'medium';
