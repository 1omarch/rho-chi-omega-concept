-- Phase 14: Officer access (like Wix "Roles & Permissions"): each officer gets only the tools their job needs.
-- Run AFTER schema.sql, gallery.sql, feedback.sql, events.sql, polls.sql and checkin.sql.
-- Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run.
--
-- HOW IT WORKS
--   * Everyone on the roster is a Soror, an Officer or an Admin (this is the "level", it already existed).
--   * Admins can do everything and are the only ones who can change anyone's access.
--   * An Officer can use only the tools ticked for her. The tools are:
--       roster       Roster              add and update sorors
--       events       Events & flyers     post events with flyers and RSVP info
--       gallery      Gallery             home page photos
--       suggestions  Suggestions         read ideas sorors send from the Help page
--       meeting      Meeting tools       open check-in, start quick votes
--       finance      Finance             reserved for dues and payments (nothing to open yet)
--   * Always admin-only (cannot be handed out): tech issues, message review, changing access.
--   * The job title (Financial Manager, Website Designer, ...) is just a label with suggested ticks. Admins can change the ticks.

-- 1. Columns on the roster ----------------------------------------------------------------------------
alter table public.members add column if not exists access_title      text;
alter table public.members add column if not exists access_areas      text[] not null default array['roster', 'gallery', 'suggestions'];
alter table public.members add column if not exists access_updated_at timestamptz;
alter table public.members drop constraint if exists members_access_areas_ok;
alter table public.members add constraint members_access_areas_ok
  check (access_areas <@ array['roster', 'events', 'gallery', 'suggestions', 'meeting', 'finance']::text[]);
alter table public.members drop constraint if exists members_access_title_len;
alter table public.members add constraint members_access_title_len check (access_title is null or char_length(access_title) <= 60);
-- (officers you already have keep exactly what they could do before: roster, gallery and suggestions)

-- 2. "May I use this tool?" ----------------------------------------------------------------------------
create or replace function public.has_access(p_area text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select m.role = 'admin' or (m.role = 'officer' and p_area = any (m.access_areas))
                     from public.members m
                    where m.active and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
                    limit 1), false);
$$;

-- what the portal asks right after sign-in
create or replace function public.my_access()
returns table (access_title text, access_areas text[])
language sql stable security definer set search_path = public as $$
  select m.access_title,
         case when m.role = 'admin'   then array['roster', 'events', 'gallery', 'suggestions', 'meeting', 'finance']::text[]
              when m.role = 'officer' then m.access_areas
              else '{}'::text[] end
    from public.members m
   where m.active and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
   limit 1;
$$;
revoke all on function public.has_access(text), public.my_access() from public, anon;
grant execute on function public.has_access(text), public.my_access() to authenticated;

-- 3. Guard rails on the roster ---------------------------------------------------------------------------
-- only admins change a level, a title or ticks; there is always at least one active admin; the "since" date is kept up to date
create or replace function public.members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' and old.active
       and not exists (select 1 from public.members x where x.id <> old.id and x.role = 'admin' and x.active) then
      raise exception 'There must always be at least one active admin.';
    end if;
    return old;
  end if;
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.access_title is distinct from old.access_title or new.access_areas is distinct from old.access_areas) then
    raise exception 'Only admins can change officer access.';
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.members x where x.id <> old.id and x.role = 'admin' and x.active) then
    raise exception 'There must always be at least one active admin.';
  end if;
  if new.role is distinct from old.role or new.access_title is distinct from old.access_title
     or new.access_areas is distinct from old.access_areas or new.active is distinct from old.active then
    new.access_updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists members_guard_trg on public.members;
create trigger members_guard_trg before update or delete on public.members
  for each row execute function public.members_guard();

-- 4. Each tool now asks "has_access(...)" instead of "is she any officer / admin?" --------------------------
-- Roster: everyone who is an officer can still SEE names (committees and the directory need that), but adding or editing needs "roster"
drop policy if exists "roster: officers add"  on public.members;
drop policy if exists "roster: officers edit" on public.members;
create policy "roster: officers add" on public.members for insert to authenticated
  with check (public.is_admin() or (public.has_access('roster') and role = 'member'));
create policy "roster: officers edit" on public.members for update to authenticated
  using      (public.is_admin() or (public.has_access('roster') and role = 'member'))
  with check (public.is_admin() or (public.has_access('roster') and role = 'member'));

-- Gallery
drop policy if exists "gallery: officers add"    on public.gallery_items;
drop policy if exists "gallery: officers edit"   on public.gallery_items;
drop policy if exists "gallery: officers delete" on public.gallery_items;
create policy "gallery: officers add"    on public.gallery_items for insert to authenticated with check (public.has_access('gallery'));
create policy "gallery: officers edit"   on public.gallery_items for update to authenticated using (public.has_access('gallery')) with check (public.has_access('gallery'));
create policy "gallery: officers delete" on public.gallery_items for delete to authenticated using (public.has_access('gallery'));

drop policy if exists "gallery files: officers add"    on storage.objects;
drop policy if exists "gallery files: officers change" on storage.objects;
drop policy if exists "gallery files: officers remove" on storage.objects;
create policy "gallery files: officers add"    on storage.objects for insert to authenticated with check (bucket_id = 'gallery' and public.has_access('gallery'));
create policy "gallery files: officers change" on storage.objects for update to authenticated using (bucket_id = 'gallery' and public.has_access('gallery')) with check (bucket_id = 'gallery' and public.has_access('gallery'));
create policy "gallery files: officers remove" on storage.objects for delete to authenticated using (bucket_id = 'gallery' and public.has_access('gallery'));

-- Suggestions (tech issues stay admin-only)
drop policy if exists "feedback: reviewers read"   on public.feedback;
drop policy if exists "feedback: reviewers update" on public.feedback;
drop policy if exists "feedback: reviewers delete" on public.feedback;
create policy "feedback: reviewers read"   on public.feedback for select to authenticated
  using ((kind = 'suggestion' and public.has_access('suggestions')) or public.is_admin());
create policy "feedback: reviewers update" on public.feedback for update to authenticated
  using      ((kind = 'suggestion' and public.has_access('suggestions')) or public.is_admin())
  with check ((kind = 'suggestion' and public.has_access('suggestions')) or public.is_admin());
create policy "feedback: reviewers delete" on public.feedback for delete to authenticated
  using ((kind = 'suggestion' and public.has_access('suggestions')) or public.is_admin());

drop policy if exists "feedback voice: read"   on storage.objects;
drop policy if exists "feedback voice: remove" on storage.objects;
create policy "feedback voice: read" on storage.objects for select to authenticated
  using (bucket_id = 'feedback-voice'
         and (((storage.foldername(name))[2] = 'suggestion' and public.has_access('suggestions')) or public.is_admin()));
create policy "feedback voice: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'feedback-voice'
         and (((storage.foldername(name))[2] = 'suggestion' and public.has_access('suggestions')) or public.is_admin()
              or (storage.foldername(name))[1] = public.my_member_id()::text));

-- Events & flyers
drop policy if exists "events: admins add"    on public.chapter_events;
drop policy if exists "events: admins change" on public.chapter_events;
drop policy if exists "events: admins delete" on public.chapter_events;
create policy "events: admins add"    on public.chapter_events for insert to authenticated
  with check (public.has_access('events') and created_by = public.my_member_id());
create policy "events: admins change" on public.chapter_events for update to authenticated
  using (public.has_access('events')) with check (public.has_access('events'));
create policy "events: admins delete" on public.chapter_events for delete to authenticated using (public.has_access('events'));

drop policy if exists "event flyers: admins add"    on storage.objects;
drop policy if exists "event flyers: admins remove" on storage.objects;
create policy "event flyers: admins add" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-flyers' and public.has_access('events'));
create policy "event flyers: admins remove" on storage.objects for delete to authenticated
  using (bucket_id = 'event-flyers' and public.has_access('events'));

-- Quick votes
drop policy if exists "polls: admins start"  on public.polls;
drop policy if exists "polls: admins close"  on public.polls;
drop policy if exists "polls: admins delete" on public.polls;
create policy "polls: admins start" on public.polls for insert to authenticated
  with check (public.has_access('meeting') and created_by = public.my_member_id() and status = 'open');
create policy "polls: admins close" on public.polls for update to authenticated
  using (public.has_access('meeting')) with check (public.has_access('meeting'));
create policy "polls: admins delete" on public.polls for delete to authenticated using (public.has_access('meeting'));

-- Meeting check-in
create or replace function public.open_checkin(p_title text default 'Chapter meeting')
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.has_access('meeting') then raise exception 'You do not have access to meeting tools.'; end if;
  update public.checkin_sessions set closed_at = now() where closed_at is null;
  insert into public.checkin_sessions (title, opened_by)
    values (coalesce(nullif(btrim(p_title), ''), 'Chapter meeting'), public.my_member_id()) returning id into sid;
  return sid;
end $$;

create or replace function public.close_checkin(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_access('meeting') then raise exception 'You do not have access to meeting tools.'; end if;
  update public.checkin_sessions set closed_at = coalesce(closed_at, now()) where id = p_session;
end $$;

drop function if exists public.my_checkin();
create or replace function public.my_checkin()
returns table (session_id uuid, title text, opened_at timestamptz, i_checked_in boolean, present_count int)
language sql stable security definer set search_path = public as $$
  select s.id, s.title, s.opened_at,
         exists (select 1 from public.checkins c where c.session_id = s.id and c.member_id = public.my_member_id()),
         case when public.has_access('meeting') then (select count(*)::int from public.checkins c where c.session_id = s.id) end
    from public.checkin_sessions s
   where public.is_member() and s.closed_at is null and s.opened_at > now() - interval '6 hours'
   order by s.opened_at desc
   limit 1;
$$;

create or replace function public.checkin_roster(p_session uuid)
returns table (member_id uuid, full_name text, checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.full_name, c.checked_in_at
    from public.checkins c join public.members m on m.id = c.member_id
   where public.has_access('meeting') and c.session_id = p_session
   order by m.full_name;
$$;

drop function if exists public.my_polls();
create or replace function public.my_polls()
returns table (id uuid, question text, is_open boolean, created_at timestamptz, closed_at timestamptz,
               i_voted boolean, yes_count int, no_count int, audience text, can_vote boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.question,
         (p.status = 'open' and p.created_at > now() - interval '1 day') as is_open,
         p.created_at, p.closed_at,
         exists (select 1 from public.poll_voters v where v.poll_id = p.id and v.member_id = public.my_member_id()) as i_voted,
         case when public.has_access('meeting') or not (p.status = 'open' and p.created_at > now() - interval '1 day')
              then (select count(*)::int from public.poll_votes x where x.poll_id = p.id and x.choice = 'yes') end as yes_count,
         case when public.has_access('meeting') or not (p.status = 'open' and p.created_at > now() - interval '1 day')
              then (select count(*)::int from public.poll_votes x where x.poll_id = p.id and x.choice = 'no') end as no_count,
         p.audience,
         (p.audience = 'everyone'
          or exists (select 1 from public.checkins c where c.session_id = p.session_id and c.member_id = public.my_member_id())) as can_vote
    from public.polls p
   where public.is_member()
   order by p.created_at desc
   limit 30;
$$;
revoke all on function public.open_checkin(text), public.close_checkin(uuid), public.my_checkin(), public.checkin_roster(uuid), public.my_polls() from public, anon;
grant execute on function public.open_checkin(text), public.close_checkin(uuid), public.my_checkin(), public.checkin_roster(uuid), public.my_polls() to authenticated;

-- 5. Check (optional): all three should say true
select (select count(*) from pg_proc where proname in ('has_access', 'my_access', 'members_guard')) = 3 as access_functions_ready,
       (select count(*) from information_schema.columns where table_name = 'members' and column_name in ('access_title', 'access_areas', 'access_updated_at')) = 3 as members_upgraded,
       (select count(*) from public.members where role = 'admin' and active) >= 1 as has_an_admin;
