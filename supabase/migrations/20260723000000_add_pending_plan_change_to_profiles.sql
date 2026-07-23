ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pending_plan_role text,
  ADD COLUMN IF NOT EXISTS pending_subscription_duration text,
  ADD COLUMN IF NOT EXISTS pending_plan_start_date date,
  ADD COLUMN IF NOT EXISTS pending_plan_end_date date;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_pending_subscription_duration_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_pending_subscription_duration_check
  CHECK (
    pending_subscription_duration IS NULL
    OR pending_subscription_duration IN ('monthly', 'quarterly', 'half_yearly', 'yearly')
  );
