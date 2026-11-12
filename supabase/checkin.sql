-- Phase 13: Meeting check-in, and quick votes that only reach sorors who are checked in.
-- Run AFTER supabase/polls.sql. Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run.
--
-- HOW IT WORKS
--   * At the start of a meeting an admin taps "Open meeting check-in". Sorors who are in the room tap "I'm here".
--   * The admin sees a live Present count (a true head count) and, if wanted, the names. Only admins can see names.
--   * When starting a quick vote the admin chooses "Checked-in sorors only" (the pop-up and notification reach only them,
--     and the database refuses votes from anyone else) or "Everyone".
--   * A check-in closes by itself after 6 hours, and check-in records are permanently deleted 30 days after the meeting.

-- 1. Meeting check-ins -----------------------------------------------------------------------------
create table if not exists public.checkin_sessions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Chapter meeting' check (char_length(btrim(title)) between 1 and 80),
  opened_by  uuid references public.members(id) on delete set null,
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz
);
create table if not exists public.checkins (
  session_id    uuid not null references public.checkin_sessions(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (session_id, member_id)
);
-- nobody reads or writes these tables directly; the functions below do everything
alter table public.checkin_sessions enable row level security;
alter table public.checkins         enable row level security;
revoke all on public.checkin_sessions, public.checkins from anon, authenticated;

-- an admin opens a check-in (any earlier open one is closed first)
create or replace function public.open_checkin(p_title text default 'Chapter meeting')
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'Only admins can open a meeting check-in.'; end if;
  update public.checkin_sessions set closed_at = now() where closed_at is null;
  insert into public.checkin_sessions (title, opened_by)
    values (coalesce(nullif(btrim(p_title), ''), 'Chapter meeting'), public.my_member_id()) returning id into sid;
  return sid;
end $$;

create or replace function public.close_checkin(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can close a meeting check-in.'; end if;
  update public.checkin_sessions set closed_at = coalesce(closed_at, now()) where id = p_session;
end $$;

-- a soror checks herself in (only while the check-in is open)
create or replace function public.check_in(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_member_id();
begin
  if me is null then raise exception 'You need to be signed in.'; end if;
  if not exists (select 1 from public.checkin_sessions s
                  where s.id = p_session and s.closed_at is null and s.opened_at > now() - interval '6 hours') then
    raise exception 'This meeting check-in is closed.';
  end if;
  insert into public.checkins (session_id, member_id) values (p_session, me) on conflict do nothing;
end $$;

-- the open check-in, if any: whether I am in, and (admins only) how many are present
create or replace function public.my_checkin()
returns table (session_id uuid, title text, opened_at timestamptz, i_checked_in boolean, present_count int)
language sql stable security definer set search_path = public as $$
  select s.id, s.title, s.opened_at,
         exists (select 1 from public.checkins c where c.session_id = s.id and c.member_id = public.my_member_id()),
         case when public.is_admin() then (select count(*)::int from public.checkins c where c.session_id = s.id) end
    from public.checkin_sessions s
   where public.is_member() and s.closed_at is null and s.opened_at > now() - interval '6 hours'
   order by s.opened_at desc
   limit 1;
$$;

-- who is present (admins only)
create or replace function public.checkin_roster(p_session uuid)
returns table (member_id uuid, full_name text, checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.full_name, c.checked_in_at
    from public.checkins c join public.members m on m.id = c.member_id
   where public.is_admin() and c.session_id = p_session
   order by m.full_name;
$$;

revoke all on function public.open_checkin(text), public.close_checkin(uuid), public.check_in(uuid), public.my_checkin(),
  public.checkin_roster(uuid) from public, anon;
grant execute on function public.open_checkin(text), public.close_checkin(uuid), public.check_in(uuid), public.my_checkin(),
  public.checkin_roster(uuid) to authenticated;

-- 2. Votes can be limited to sorors who are checked in ----------------------------------------------
alter table public.polls add column if not exists audience   text not null default 'everyone';
alter table public.polls add column if not exists session_id uuid references public.checkin_sessions(id) on delete set null;
alter table public.polls drop constraint if exists polls_audience_ok;
alter table public.polls add constraint polls_audience_ok
  check (audience in ('everyone', 'present') and (audience = 'everyone' or session_id is not null));

create or replace function public.cast_vote(p_poll uuid, p_choice text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_member_id(); p public.polls;
begin
  if me is null then raise exception 'You need to be signed in to vote.'; end if;
  if p_choice not in ('yes', 'no') then raise exception 'Please choose Yes or No.'; end if;
  select * into p from public.polls where id = p_poll;
  if not found then raise exception 'That vote is no longer available.'; end if;
  if p.status <> 'open' or p.created_at < now() - interval '1 day' then raise exception 'Voting on this question is closed.'; end if;
  if p.audience = 'present' and not exists (select 1 from public.checkins c where c.session_id = p.session_id and c.member_id = me) then
    raise exception 'This vote is only for sorors who are checked in to the meeting.';
  end if;
  begin
    insert into public.poll_voters (poll_id, member_id) values (p_poll, me);
  exception when unique_violation then
    raise exception 'You have already voted on this question.';
  end;
  insert into public.poll_votes (poll_id, choice) values (p_poll, p_choice);
end $$;

-- what a soror sees (now also says whether SHE may vote on each question)
drop function if exists public.my_polls();
create or replace function public.my_polls()
returns table (id uuid, question text, is_open boolean, created_at timestamptz, closed_at timestamptz,
               i_voted boolean, yes_count int, no_count int, audience text, can_vote boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.question,
         (p.status = 'open' and p.created_at > now() - interval '1 day') as is_open,
         p.created_at, p.closed_at,
         exists (select 1 from public.poll_voters v where v.poll_id = p.id and v.member_id = public.my_member_id()) as i_voted,
         case when public.is_admin() or not (p.status = 'open' and p.created_at > now() - interval '1 day')
              then (select count(*)::int from public.poll_votes x where x.poll_id = p.id and x.choice = 'yes') end as yes_count,
         case when public.is_admin() or not (p.status = 'open' and p.created_at > now() - interval '1 day')
              then (select count(*)::int from public.poll_votes x where x.poll_id = p.id and x.choice = 'no') end as no_count,
         p.audience,
         (p.audience = 'everyone'
          or exists (select 1 from public.checkins c where c.session_id = p.session_id and c.member_id = public.my_member_id())) as can_vote
    from public.polls p
   where public.is_member()
   order by p.created_at desc
   limit 30;
$$;
revoke all on function public.my_polls() from public, anon;
grant execute on function public.my_polls() to authenticated;

-- 3. Clean-up: check-ins close after 6 hours and are deleted 30 days after the meeting -----------------
create or replace function public.purge_polls()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_closed int; n_gone int; n_sessions int;
begin
  update public.polls set status = 'closed', closed_at = coalesce(closed_at, now())
   where status = 'open' and created_at < now() - interval '1 day';
  get diagnostics n_closed = row_count;
  delete from public.polls where created_at < now() - make_interval(days => public.retention_days('polls', 30));
  get diagnostics n_gone = row_count;
  update public.checkin_sessions set closed_at = coalesce(closed_at, now())
   where closed_at is null and opened_at < now() - interval '6 hours';
  delete from public.checkin_sessions where opened_at < now() - make_interval(days => public.retention_days('polls', 30));
  get diagnostics n_sessions = row_count;
  return jsonb_build_object('closed', n_closed, 'deleted', n_gone, 'check_ins_deleted', n_sessions);
end $$;
revoke all on function public.purge_polls() from public, anon, authenticated;

-- 4. Check (optional): both should say true
select (select count(*) from pg_proc where proname in ('open_checkin', 'close_checkin', 'check_in', 'my_checkin', 'checkin_roster')) = 5 as checkin_functions_ready,
       (select count(*) from information_schema.columns where table_name = 'polls' and column_name in ('audience', 'session_id')) = 2 as polls_upgraded;
