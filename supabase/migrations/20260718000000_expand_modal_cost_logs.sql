-- Migration: Expand modal_cost_logs to support dynamic resources and other function costs

-- Make photo_id and event_id columns nullable to support non-photo-specific functions (like search / selfies / batch orchestration)
ALTER TABLE public.modal_cost_logs ALTER COLUMN photo_id DROP NOT NULL;
ALTER TABLE public.modal_cost_logs ALTER COLUMN event_id DROP NOT NULL;

-- Add new columns for tracking compute resources and function names
ALTER TABLE public.modal_cost_logs 
    ADD COLUMN IF NOT EXISTS function_name TEXT DEFAULT 'process_single_photo' NOT NULL,
    ADD COLUMN IF NOT EXISTS cpu_cores DOUBLE PRECISION DEFAULT 1.0 NOT NULL,
    ADD COLUMN IF NOT EXISTS memory_gb DOUBLE PRECISION DEFAULT 1.0 NOT NULL,
    ADD COLUMN IF NOT EXISTS gpu_type TEXT DEFAULT 'None';
