create table if not exists public.vendor_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text not null,
  category text not null,
  city text not null,
  phone text not null,
  email text,
  website text,
  notes text,
  source text not null default 'mobile',
  status text not null default 'new',
  user_agent text,
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  constraint vendor_leads_status_check check (status in ('new', 'contacted', 'onboarded', 'rejected')),
  constraint vendor_leads_source_check check (source in ('web', 'mobile'))
);

alter table public.vendor_leads enable row level security;

drop policy if exists "Admins can view vendor leads" on public.vendor_leads;
create policy "Admins can view vendor leads"
on public.vendor_leads
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id::text = auth.uid()::text
      and profiles.role = 'admin'
      and profiles.delegated_by is null
  )
);

drop policy if exists "Admins can update vendor leads" on public.vendor_leads;
create policy "Admins can update vendor leads"
on public.vendor_leads
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id::text = auth.uid()::text
      and profiles.role = 'admin'
      and profiles.delegated_by is null
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id::text = auth.uid()::text
      and profiles.role = 'admin'
      and profiles.delegated_by is null
  )
);

create index if not exists vendor_leads_created_at_idx on public.vendor_leads (created_at desc);
create index if not exists vendor_leads_status_idx on public.vendor_leads (status);
