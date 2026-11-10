-- Phase 8: app-style notifications and reminders (web push), committee meetings, and officer announcements.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.

-- 1. Phones and computers that have turned notifications on ---------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_member on public.push_subscriptions (member_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
drop policy if exists "push: own read"   on public.push_subscriptions;
drop policy if exists "push: own add"    on public.push_subscriptions;
drop policy if exists "push: own remove" on public.push_subscriptions;
create policy "push: own read"   on public.push_subscriptions for select to authenticated using (member_id = public.my_member_id());
create policy "push: own add"    on public.push_subscriptions for insert to authenticated with check (member_id = public.my_member_id());
create policy "push: own remove" on public.push_subscriptions for delete to authenticated using (member_id = public.my_member_id());

-- 2. Turn reminders on or off for one RSVP, or for one committee -----------------------------
alter table public.member_activity   add column if not exists remind boolean not null default true;
alter table public.member_committees add column if not exists remind boolean not null default true;
-- a soror may change only the reminder switch on her own rows (never her committee role)
revoke update on public.member_committees from authenticated;
grant update (remind) on public.member_activity   to authenticated;
grant update (remind) on public.member_committees to authenticated;
drop policy if exists "activity: own update"   on public.member_activity;
drop policy if exists "committees: own update" on public.member_committees;
create policy "activity: own update"   on public.member_activity   for update to authenticated using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());
create policy "committees: own update" on public.member_committees for update to authenticated using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());

-- 3. Committee meetings ------------------------------------------------------------------------
create or replace function public.is_chair_of(c text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.member_committees mc
                 where mc.member_id = public.my_member_id() and mc.committee = c and mc.role in ('Chair', 'Co-Chair'));
$$;
revoke all on function public.is_chair_of(text) from public, anon;
grant execute on function public.is_chair_of(text) to authenticated;

create table if not exists public.committee_meetings (
  id          uuid primary key default gen_random_uuid(),
  committee   text not null check (char_length(committee) between 1 and 80),
  title       text not null check (char_length(title) between 1 and 120),
  starts_at   timestamptz not null,
  location    text check (char_length(location) <= 200),
  notes       text check (char_length(notes) <= 500),
  created_by  uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists committee_meetings_starts on public.committee_meetings (starts_at);
alter table public.committee_meetings enable row level security;
revoke all on public.committee_meetings from anon, authenticated;
grant select, insert, update, delete on public.committee_meetings to authenticated;
drop policy if exists "meetings: members read"     on public.committee_meetings;
drop policy if exists "meetings: chairs add"       on public.committee_meetings;
drop policy if exists "meetings: chairs edit"      on public.committee_meetings;
drop policy if exists "meetings: chairs remove"    on public.committee_meetings;
create policy "meetings: members read" on public.committee_meetings for select to authenticated using (public.is_member());
create policy "meetings: chairs add" on public.committee_meetings for insert to authenticated
  with check (created_by = public.my_member_id() and (public.is_officer() or public.is_chair_of(committee)));
create policy "meetings: chairs edit" on public.committee_meetings for update to authenticated
  using (public.is_officer() or public.is_chair_of(committee)) with check (public.is_officer() or public.is_chair_of(committee));
create policy "meetings: chairs remove" on public.committee_meetings for delete to authenticated
  using (public.is_officer() or public.is_chair_of(committee));

-- 4. Notifications that officers send (and a test a soror can send herself) ----------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 80),
  body        text not null check (char_length(body) between 1 and 240),
  url         text check (char_length(url) <= 200),
  audience    text not null default 'all' check (char_length(audience) <= 100),   -- all | committee:<name> | member:<id>
  created_by  uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, insert on public.notifications to authenticated;
drop policy if exists "notes: officers read" on public.notifications;
drop policy if exists "notes: send"          on public.notifications;
create policy "notes: officers read" on public.notifications for select to authenticated using (public.is_officer());
create policy "notes: send" on public.notifications for insert to authenticated
  with check (created_by = public.my_member_id() and (public.is_officer() or audience = 'member:' || public.my_member_id()::text));

-- 5. What has already been sent, so nobody gets the same reminder twice (the server writes to this) ----
create table if not exists public.reminder_log (
  key      text primary key,
  sent_at  timestamptz not null default now()
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;
