-- Phase 7: "My Involvement" on each profile: RSVPs, purchases and donations, committees, and honors.
-- Everything here is private to the soror (officers can also set honors and committees).
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.

-- 1. A soror's own list of RSVPs, purchases and donations ---------------------------------
create table if not exists public.member_activity (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  kind        text not null check (kind in ('rsvp', 'purchase', 'donation')),
  title       text not null check (char_length(title) between 1 and 120),
  event_date  date,
  amount      numeric(10, 2) check (amount is null or (amount >= 0 and amount <= 100000)),
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists member_activity_member on public.member_activity (member_id, event_date desc);

alter table public.member_activity enable row level security;
revoke all on public.member_activity from anon, authenticated;
grant select, insert, delete on public.member_activity to authenticated;
drop policy if exists "activity: own read"   on public.member_activity;
drop policy if exists "activity: own add"    on public.member_activity;
drop policy if exists "activity: own remove" on public.member_activity;
create policy "activity: own read"   on public.member_activity for select to authenticated using (member_id = public.my_member_id());
create policy "activity: own add"    on public.member_activity for insert to authenticated with check (member_id = public.my_member_id());
create policy "activity: own remove" on public.member_activity for delete to authenticated using (member_id = public.my_member_id());

-- 2. Committees a soror belongs to -------------------------------------------------------------
create table if not exists public.member_committees (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  committee   text not null check (char_length(committee) between 1 and 80),
  role        text not null default 'Member' check (role in ('Member', 'Chair', 'Co-Chair')),
  created_at  timestamptz not null default now(),
  unique (member_id, committee)
);
alter table public.member_committees enable row level security;
revoke all on public.member_committees from anon, authenticated;
grant select, insert, update, delete on public.member_committees to authenticated;
drop policy if exists "committees: own read"      on public.member_committees;
drop policy if exists "committees: own add"       on public.member_committees;
drop policy if exists "committees: own remove"    on public.member_committees;
drop policy if exists "committees: officers all"  on public.member_committees;
create policy "committees: own read"   on public.member_committees for select to authenticated using (member_id = public.my_member_id());
create policy "committees: own add"    on public.member_committees for insert to authenticated with check (member_id = public.my_member_id() and role = 'Member');
create policy "committees: own remove" on public.member_committees for delete to authenticated using (member_id = public.my_member_id());
create policy "committees: officers all" on public.member_committees for all to authenticated using (public.is_officer()) with check (public.is_officer());

-- 3. Honors (Silver Star, Golden Soror, Pearl Soror, Diamond Soror) ----------------------------
-- empty = worked out automatically from her initiation year; 'none' hides it; officers can set one by hand
alter table public.profiles add column if not exists honor text
  check (honor in ('none', 'silver_star', 'golden_soror', 'pearl_soror', 'diamond_soror'));

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_officer() then
    if tg_op = 'INSERT' then new.title := null; new.honor := null;
    else new.title := old.title; new.honor := old.honor; end if;
  end if;
  return new;
end $$;
