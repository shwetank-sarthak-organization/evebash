-- Migration: Add modal_cost_logs table to track face indexing executions and costs
CREATE TABLE IF NOT EXISTS public.modal_cost_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    execution_time_seconds DOUBLE PRECISION NOT NULL,
    estimated_cost_inr DOUBLE PRECISION NOT NULL,
    faces_detected INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.modal_cost_logs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated/service role access to select/insert
CREATE POLICY "Allow service role full access" ON public.modal_cost_logs
    USING (true)
    WITH CHECK (true);
