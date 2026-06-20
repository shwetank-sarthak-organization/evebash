alter table public.events
add column if not exists cover_offset numeric not null default 0,
add column if not exists cover_offset_x numeric not null default 0,
add column if not exists cover_scale numeric not null default 1,
add column if not exists cover_mode text not null default 'fill';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_cover_mode_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
    add constraint events_cover_mode_check
    check (cover_mode in ('fit', 'fill'))
    not valid;
  end if;
end $$;

alter table public.events
validate constraint events_cover_mode_check;
