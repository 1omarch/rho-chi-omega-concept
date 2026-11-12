-- Phase 10: Suggestion box and Tech issue box on the Help page (typed text or a recorded voice note; tech issues can also attach one screenshot).
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.
--
-- WHO CAN SEE WHAT
--   * Any signed-in soror can SEND a suggestion or a tech issue. She cannot read anything back (not even her own).
--   * Suggestions are read by officers and admins.
--   * Tech issues are read by ADMINS ONLY (officers cannot see them).
--   * Both kinds are deleted automatically 365 days after they were sent (change it in Table Editor > retention_rules > feedback).
--   * A soror can send at most 10 per day (stops accidents and spam).

-- 1. The messages ------------------------------------------------------------------------------
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid references public.members(id) on delete set null,
  kind        text not null check (kind in ('suggestion', 'tech')),
  body        text not null default '' check (char_length(body) <= 2000),
  device      text check (device is null or char_length(device) <= 400),   -- phone/browser details, tech issues only
  voice_path  text,                                                         -- the recorded voice note (bucket feedback-voice)
  image_path  text,                                                         -- one screenshot, tech issues only (same bucket)
  status      text not null default 'new' check (status in ('new', 'done')),
  created_at  timestamptz not null default now(),
  constraint feedback_not_empty check (char_length(btrim(body)) > 0 or voice_path is not null or image_path is not null),
  constraint feedback_voice_folder check (voice_path is null or voice_path like member_id::text || '/' || kind || '/%')
);

-- upgrade for installs that ran an earlier version of this file (safe to repeat)
alter table public.feedback add column if not exists image_path text;
alter table public.feedback drop constraint if exists feedback_not_empty;
alter table public.feedback add constraint feedback_not_empty
  check (char_length(btrim(body)) > 0 or voice_path is not null or image_path is not null);
alter table public.feedback drop constraint if exists feedback_image_folder;
alter table public.feedback add constraint feedback_image_folder
  check (image_path is null or (kind = 'tech' and image_path like member_id::text || '/tech/%'));
create index if not exists feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;

revoke all on public.feedback from anon, authenticated;
grant insert (member_id, kind, body, device, voice_path, image_path) on public.feedback to authenticated;
grant select, delete on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;

drop policy if exists "feedback: members send"        on public.feedback;
drop policy if exists "feedback: reviewers read"      on public.feedback;
drop policy if exists "feedback: reviewers update"    on public.feedback;
drop policy if exists "feedback: reviewers delete"    on public.feedback;

create policy "feedback: members send" on public.feedback for insert to authenticated
  with check (member_id = public.my_member_id() and status = 'new');

-- suggestions: officers and admins.  tech issues: admins only.
create policy "feedback: reviewers read"   on public.feedback for select to authenticated
  using ((kind = 'suggestion' and public.is_officer()) or public.is_admin());
create policy "feedback: reviewers update" on public.feedback for update to authenticated
  using      ((kind = 'suggestion' and public.is_officer()) or public.is_admin())
  with check ((kind = 'suggestion' and public.is_officer()) or public.is_admin());
create policy "feedback: reviewers delete" on public.feedback for delete to authenticated
  using ((kind = 'suggestion' and public.is_officer()) or public.is_admin());

-- 2. Limit: 10 per soror per day ----------------------------------------------------------------
create or replace function public.feedback_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.feedback where member_id = new.member_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have sent several messages today already. Please try again tomorrow.';
  end if;
  return new;
end $$;
drop trigger if exists feedback_before_insert on public.feedback;
create trigger feedback_before_insert before insert on public.feedback
  for each row execute function public.feedback_limit();

-- 3. Voice notes and screenshots: private bucket -----------------------------------------------------------------
-- File names look like  <soror id>/<suggestion or tech>/<file>.wav  (or .jpg for a screenshot)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-voice', 'feedback-voice', false, 10485760, array['audio/wav', 'audio/x-wav', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feedback voice: send"   on storage.objects;
drop policy if exists "feedback voice: read"   on storage.objects;
drop policy if exists "feedback voice: remove" on storage.objects;

create policy "feedback voice: send" on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-voice'
              and (storage.foldername(name))[1] = public.my_member_id()::text
              and (storage.foldername(name))[2] in ('suggestion', 'tech'));
create policy "feedback voice: read" on storage.objects for select to authenticated
  using (bucket_id = 'feedback-voice'
         and (((storage.foldername(name))[2] = 'suggestion' and public.is_officer()) or public.is_admin()));
create policy "feedback voice: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'feedback-voice'
         and (((storage.foldername(name))[2] = 'suggestion' and public.is_officer()) or public.is_admin()
              or (storage.foldername(name))[1] = public.my_member_id()::text));

-- 4. Clean-up of voice files -----------------------------------------------------------------------
-- When a message is deleted (by hand or by the 365-day rule) its voice file is queued for removal. The queue now
-- remembers which bucket each file lives in; the reminder sender (every 5 minutes) removes them.
alter table public.storage_purge_queue add column if not exists bucket text not null default 'message-files';

drop policy if exists "purge queue: members read"  on public.storage_purge_queue;
drop policy if exists "purge queue: members clear" on public.storage_purge_queue;
create policy "purge queue: members read"  on public.storage_purge_queue for select to authenticated
  using (public.is_member() and bucket = 'message-files');
create policy "purge queue: members clear" on public.storage_purge_queue for delete to authenticated
  using (public.is_member() and bucket = 'message-files');

create or replace function public.feedback_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.voice_path is not null then
    insert into public.storage_purge_queue (path, bucket) values (old.voice_path, 'feedback-voice') on conflict do nothing;
  end if;
  if old.image_path is not null then
    insert into public.storage_purge_queue (path, bucket) values (old.image_path, 'feedback-voice') on conflict do nothing;
  end if;
  return old;
end $$;
drop trigger if exists feedback_after_delete on public.feedback;
create trigger feedback_after_delete after delete on public.feedback
  for each row execute function public.feedback_after_delete();

-- 5. Retention: delete after 365 days (adds one line to the nightly clean-up) -----------------------
insert into public.retention_rules (key, keep_days, note) values
  ('feedback', 365, 'Suggestion box and tech issue messages, counted from the day they were sent')
on conflict (key) do nothing;

create or replace function public.purge_old_records()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_log int; n_notes int; n_meet int; n_rsvp int; n_fb int; n_run int;
begin
  delete from public.reminder_log
   where sent_at < now() - make_interval(days => public.retention_days('reminder_log', 365));
  get diagnostics n_log = row_count;

  delete from public.notifications
   where created_at < now() - make_interval(days => public.retention_days('notifications', 365));
  get diagnostics n_notes = row_count;

  delete from public.committee_meetings
   where starts_at < now() - make_interval(days => public.retention_days('committee_meetings', 365));
  get diagnostics n_meet = row_count;

  delete from public.member_activity
   where kind = 'rsvp'
     and coalesce(event_date, created_at::date) < current_date - public.retention_days('rsvps', 365);
  get diagnostics n_rsvp = row_count;

  delete from public.feedback
   where created_at < now() - make_interval(days => public.retention_days('feedback', 365));
  get diagnostics n_fb = row_count;

  delete from public.retention_log where ran_at < now() - interval '365 days';
  get diagnostics n_run = row_count;

  insert into public.retention_log (details) values (jsonb_build_object(
    'reminder_log', n_log, 'notifications', n_notes, 'committee_meetings', n_meet, 'rsvps', n_rsvp,
    'feedback', n_fb, 'old_log_lines', n_run));
  return jsonb_build_object('reminder_log', n_log, 'notifications', n_notes, 'committee_meetings', n_meet,
                            'rsvps', n_rsvp, 'feedback', n_fb);
end $$;
revoke all on function public.purge_old_records() from public, anon, authenticated;

-- 6. Check (optional): both lines should say true
select (select count(*) from storage.buckets where id = 'feedback-voice') = 1 as voice_bucket_ready,
       (select count(*) from pg_policies where tablename = 'feedback') = 4  as four_rules_ready;
