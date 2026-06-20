alter table public.businesses
add column if not exists portfolio_events jsonb not null default '[]'::jsonb;
