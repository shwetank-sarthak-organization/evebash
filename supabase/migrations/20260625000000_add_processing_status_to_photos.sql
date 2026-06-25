ALTER TABLE photos ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'completed';
