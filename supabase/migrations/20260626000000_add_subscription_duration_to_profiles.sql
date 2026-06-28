ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_duration text DEFAULT 'monthly';

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_subscription_duration_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_subscription_duration_check
CHECK (subscription_duration IN ('monthly', 'quarterly', 'half_yearly', 'yearly'));
