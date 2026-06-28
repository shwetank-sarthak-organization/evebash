ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS plan_start_date date,
ADD COLUMN IF NOT EXISTS plan_end_date date;

UPDATE profiles
SET
  plan_start_date = COALESCE(plan_start_date, CURRENT_DATE),
  plan_end_date = COALESCE(
    plan_end_date,
    (
      COALESCE(plan_start_date, CURRENT_DATE) +
      CASE COALESCE(subscription_duration, 'monthly')
        WHEN 'quarterly' THEN INTERVAL '3 months'
        WHEN 'half_yearly' THEN INTERVAL '6 months'
        WHEN 'yearly' THEN INTERVAL '12 months'
        ELSE INTERVAL '1 month'
      END
    )::date
  )
WHERE LOWER(COALESCE(role, 'free')) NOT IN ('admin', 'free', 'user', 'freemium');
