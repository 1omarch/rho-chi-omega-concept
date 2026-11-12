-- Phase 11: Quick votes (yes / no polls) for use during meetings.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.
--
-- HOW IT WORKS
--   * Admins start a yes/no question. Every soror sees it pop up on her phone (and gets a notification) and taps Yes or No.
--   * One vote per soror. The vote itself is stored WITHOUT her name: the app never shows who voted what, to anyone.
--     (A separate list only records "this soror has voted", so nobody can vote twice.)
--   * Admins watch the live count. When voting is closed, every soror can see the result.
--   * A vote is permanently deleted 30 days after it was started (change it in Table Editor > retention_rules > polls).
--   * A vote left open is automatically treated as closed after 24 hours.

-- 1. The questions ----------------------------------------------------------------------------
create table if not exists public.polls (
  id          uuid primary key default gen_random_uuid(),
  question    text not null check (char_length(btrim(question)) between 1 and 200),
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_by  uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
alter table public.polls enable row level security;
revoke all on public.polls from anon, authenticated;
grant select, insert, delete on public.polls to authenticated;
grant update (status, closed_at) on public.polls to authenticated;

drop policy if exists "polls: members read"  on public.polls;
drop policy if exists "polls: admins start"  on public.polls;
drop policy if exists "polls: admins close"  on public.polls;
drop policy if exists "polls: admins delete" on public.polls;
create policy "polls: members read" on public.polls for select to authenticated using (public.is_member());
create policy "polls: admins start" on public.polls for insert to authenticated
  with check (public.is_admin() and created_by = public.my_member_id() and status = 'open');
create policy "polls: admins close" on public.polls for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "polls: admins delete" on public.polls for delete to authenticated using (public.is_admin());

-- 2. The votes: no name, no time ---------------------------------------------------------------
create table if not exists public.poll_votes (
  poll_id  uuid not null references public.polls(id) on delete cascade,
  choice   text not null check (choice in ('yes', 'no'))
);
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

-- who has voted (so nobody votes twice). This list does not say what anyone voted.
create table if not exists public.poll_voters (
  poll_id    uuid not null references public.polls(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  primary key (poll_id, member_id)
);

-- nobody reads these two tables directly; everything goes through the functions below
alter table public.poll_votes  enable row level security;
alter table public.poll_voters enable row level security;
revoke all on public.poll_votes, public.poll_voters from anon, authenticated;

-- 3. Casting a vote ------------------------------------------------------------------------------
create or replace function public.cast_vote(p_poll uuid, p_choice text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_member_id(); p public.polls;
begin
  if me is null then raise exception 'You need to be signed in to vote.'; end if;
  if p_choice not in ('yes', 'no') then raise exception 'Please choose Yes or No.'; end if;
  select * into p from public.polls where id = p_poll;
  if not found then raise exception 'That vote is no longer available.'; end if;
  if p.status <> 'open' or p.created_at < now() - interval '1 day' then raise exception 'Voting on this question is closed.'; end if;
  begin
    insert into public.poll_voters (poll_id, member_id) values (p_poll, me);
  exception when unique_violation then
    raise exception 'You have already voted on this question.';
  end;
  insert into public.poll_votes (poll_id, choice) values (p_poll, p_choice);
end $$;

-- 4. What a soror (or admin) sees -----------------------------------------------------------------
-- Counts are hidden from sorors while voting is open; admins see the live count at any time.
create or replace function public.my_polls()
returns table (id uuid, question text, is_open boolean, created_at timestamptz, closed_at timestamptz,
               i_voted boolean, yes_count int, no_count int)
language sql stable security definer set search_path = public as $$
  select p.id, p.question,
         (p.status = 'open' and p.created_at > now() - interval '1 day') as is_open,
         p.created_at, p.closed_at,
         exists (select 1 from public.poll_voters v where v.poll_id = p.id and v.member_id = public.my_member_id()) as i_voted,
         case when public.is_admin() or not (p.status = 'open' and p.created_at > now() - interval '1 day')
              then (select count(*)::int from public.poll_votes x where x.poll_id = p.id and x.choice = 'yes') end as yes_count,
         case when public.is_admin() or not (p.status = 'open' and p.created_at > now() - interval '1 day')
              then (select count(*)::int from public.poll_votes x where x.poll_id = p.id and x.choice = 'no') end as no_count
    from public.polls p
   where public.is_member()
   order by p.created_at desc
   limit 30;
$$;

revoke all on function public.cast_vote(uuid, text), public.my_polls() from public, anon;
grant execute on function public.cast_vote(uuid, text), public.my_polls() to authenticated;

-- 5. Live updates for the pop-up (so a new question shows up on phones right away) ---------------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'polls') then
    alter publication supabase_realtime add table public.polls;
  end if;
end $$;

-- 6. Clean-up: delete 30 days after it was started; close anything left open for over a day ------
insert into public.retention_rules (key, keep_days, note) values
  ('polls', 30, 'Quick votes (yes/no polls) and their results, counted from the day the vote was started')
on conflict (key) do nothing;

create or replace function public.purge_polls()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_closed int; n_gone int;
begin
  update public.polls set status = 'closed', closed_at = coalesce(closed_at, now())
   where status = 'open' and created_at < now() - interval '1 day';
  get diagnostics n_closed = row_count;
  delete from public.polls where created_at < now() - make_interval(days => public.retention_days('polls', 30));
  get diagnostics n_gone = row_count;
  return jsonb_build_object('closed', n_closed, 'deleted', n_gone);
end $$;
revoke all on function public.purge_polls() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('rco-polls', '47 3 * * *', 'select public.purge_polls()');

-- 7. Check (optional): both should say true
select (select count(*) from pg_proc where proname in ('cast_vote', 'my_polls')) = 2 as functions_ready,
       (select count(*) from cron.job where jobname = 'rco-polls') = 1 as nightly_cleanup_ready;
