CREATE TABLE IF NOT EXISTS pricing_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  storage_gb numeric NOT NULL DEFAULT 0,
  storage_label text NOT NULL,
  events integer NOT NULL DEFAULT 0,
  image_upload boolean NOT NULL DEFAULT true,
  video_upload boolean NOT NULL DEFAULT true,
  video_limit_mb integer,
  monthly_actual_price numeric NOT NULL DEFAULT 0,
  monthly_price numeric NOT NULL DEFAULT 0,
  three_month_actual_price numeric NOT NULL DEFAULT 0,
  three_month_price numeric NOT NULL DEFAULT 0,
  six_month_actual_price numeric NOT NULL DEFAULT 0,
  six_month_price numeric NOT NULL DEFAULT 0,
  discounted_yearly_price numeric NOT NULL DEFAULT 0,
  yearly_price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pricing_plans
  ADD COLUMN IF NOT EXISTS monthly_actual_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS three_month_actual_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS six_month_actual_price numeric NOT NULL DEFAULT 0;

ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public pricing plan reads" ON pricing_plans;
CREATE POLICY "Allow public pricing plan reads"
ON pricing_plans
FOR SELECT
TO anon, authenticated
USING (true);

INSERT INTO pricing_plans (
  id,
  name,
  storage_gb,
  storage_label,
  events,
  image_upload,
  video_upload,
  video_limit_mb,
  monthly_actual_price,
  monthly_price,
  three_month_actual_price,
  three_month_price,
  six_month_actual_price,
  six_month_price,
  discounted_yearly_price,
  yearly_price,
  active,
  display_order
)
VALUES
  ('free', 'Free', 1, '1 GB', 1, true, true, 200, 0, 0, 0, 0, 0, 0, 0, 0, true, 1),
  ('starter', 'Starter', 10, '10 GB', 10, true, true, null, 150, 150, 450, 400, 900, 700, 1000, 1200, true, 2),
  ('basic', 'Basic', 25, '25 GB', 25, true, true, null, 300, 300, 900, 800, 1800, 1400, 2000, 2400, true, 3),
  ('standard', 'Standard', 50, '50 GB', 50, true, true, null, 450, 450, 1350, 1200, 2700, 2100, 3000, 3600, true, 4),
  ('premium', 'Premium', 100, '100 GB', 100, true, true, null, 750, 750, 2250, 2000, 4500, 3500, 5000, 6000, true, 5),
  ('pro', 'Pro', 200, '200 GB', 200, true, true, null, 1200, 1200, 3600, 3200, 7200, 5600, 8000, 9600, true, 6),
  ('elite', 'Elite', 500, '500 GB', 500, true, true, null, 2200, 2200, 6600, 6000, 13200, 10500, 15000, 18000, true, 7),
  ('ultimate', 'Ultimate', 1024, '1 TB', 1000, true, true, null, 3750, 3750, 11250, 10000, 22500, 17500, 25000, 30000, true, 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  storage_gb = EXCLUDED.storage_gb,
  storage_label = EXCLUDED.storage_label,
  events = EXCLUDED.events,
  image_upload = EXCLUDED.image_upload,
  video_upload = EXCLUDED.video_upload,
  video_limit_mb = EXCLUDED.video_limit_mb,
  monthly_actual_price = EXCLUDED.monthly_actual_price,
  monthly_price = EXCLUDED.monthly_price,
  three_month_actual_price = EXCLUDED.three_month_actual_price,
  three_month_price = EXCLUDED.three_month_price,
  six_month_actual_price = EXCLUDED.six_month_actual_price,
  six_month_price = EXCLUDED.six_month_price,
  discounted_yearly_price = EXCLUDED.discounted_yearly_price,
  yearly_price = EXCLUDED.yearly_price,
  active = EXCLUDED.active,
  display_order = EXCLUDED.display_order,
  updated_at = now();
