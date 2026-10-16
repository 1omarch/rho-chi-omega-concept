-- Phase 5: birthdays on the announcement board (month and day only; the year is never stored).
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.

alter table public.profiles add column if not exists birth_month smallint check (birth_month between 1 and 12);
alter table public.profiles add column if not exists birth_day   smallint check (birth_day between 1 and 31);
alter table public.profiles add column if not exists show_birthday boolean not null default true;

-- the next time this birthday happens on or after a date (Feb 29 falls on Feb 28 in other years)
create or replace function public.bday_next(m int, d int, on_date date)
returns date language plpgsql immutable as $$
declare y int := extract(year from on_date)::int; dim int; r date;
begin
  for i in 0..1 loop
    dim := extract(day from (make_date(y + i, m, 1) + interval '1 month' - interval '1 day'))::int;
    r := make_date(y + i, m, least(d, dim));
    if r >= on_date then return r; end if;
  end loop;
  return null;
end $$;

-- sorors with a birthday in the next few days (only those who chose to show it)
create or replace function public.upcoming_birthdays(on_date date, days int default 7)
returns table (member_id uuid, full_name text, birth_month int, birth_day int, days_away int, title text)
language sql stable security definer set search_path = public as $$
  select m.id, m.full_name, p.birth_month::int, p.birth_day::int,
         (public.bday_next(p.birth_month, p.birth_day, on_date) - on_date)::int, p.title
  from public.members m
  join public.profiles p on p.member_id = m.id
  where public.is_member() and m.active and p.show_birthday
    and p.birth_month is not null and p.birth_day is not null
    and (public.bday_next(p.birth_month, p.birth_day, on_date) - on_date) <= least(greatest(days, 0), 31)
  order by 5, m.full_name;
$$;
revoke all on function public.upcoming_birthdays(date, int) from public, anon;
grant execute on function public.upcoming_birthdays(date, int) to authenticated;
