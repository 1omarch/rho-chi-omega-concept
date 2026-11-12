-- Phase 9: automatic clean-up ("retention"), so the portal stays small and tidy for years.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.
--
-- What is cleaned up, and when (change a number any time in Table Editor > retention_rules):
--   * sent-reminder records ........ after 365 days   (rule: reminder_log)
--   * the notifications log ......... after 365 days   (rule: notifications)
--   * past committee meetings ....... after 365 days   (rule: committee_meetings)
--   * past RSVPs on profiles ........ 365 days after the event date (rule: rsvps)
--   * the clean-up's own run log .... after 365 days
-- Already handled elsewhere (messages.sql): chat messages and their attachments are destroyed 30 days after they are sent;
--   the admin message-review log is kept 1 year. Purchases and donations on a profile are NOT deleted by this file.
-- The attachment files themselves are removed from storage by the reminder sender (every 5 minutes), see section 4.

-- 1. The rules ---------------------------------------------------------------------------------
create table if not exists public.retention_rules (
  key        text primary key,
  keep_days  int  not null check (keep_days between 1 and 3650),
  note       text
);
alter table public.retention_rules enable row level security;
revoke all on public.retention_rules from anon, authenticated;

insert into public.retention_rules (key, keep_days, note) values
  ('reminder_log',       365, 'Records of reminders already sent (so nobody is reminded twice)'),
  ('notifications',      365, 'Log of notifications officers sent'),
  ('committee_meetings', 365, 'Committee meetings, counted from the meeting date'),
  ('rsvps',              365, 'RSVPs on profiles, counted from the event date')
on conflict (key) do nothing;

-- 2. A tiny record of each clean-up run (so you can see it is working) --------------------------
create table if not exists public.retention_log (
  id        bigint generated always as identity primary key,
  ran_at    timestamptz not null default now(),
  details   jsonb not null
);
alter table public.retention_log enable row level security;
revoke all on public.retention_log from anon, authenticated;

-- 3. The clean-up itself ------------------------------------------------------------------------
create or replace function public.retention_days(k text, fallback int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select keep_days from public.retention_rules where key = k), fallback);
$$;

create or replace function public.purge_old_records()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_log int; n_notes int; n_meet int; n_rsvp int; n_run int;
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

  delete from public.retention_log where ran_at < now() - interval '365 days';
  get diagnostics n_run = row_count;

  insert into public.retention_log (details) values (jsonb_build_object(
    'reminder_log', n_log, 'notifications', n_notes, 'committee_meetings', n_meet, 'rsvps', n_rsvp, 'old_log_lines', n_run));
  return jsonb_build_object('reminder_log', n_log, 'notifications', n_notes, 'committee_meetings', n_meet, 'rsvps', n_rsvp);
end $$;
revoke all on function public.purge_old_records(), public.retention_days(text, int) from public, anon, authenticated;

-- run it every night at about 3:41 AM (after the 3:23 AM message clean-up)
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('rco-retention', '41 3 * * *', 'select public.purge_old_records()');

-- 4. Attachment files: let the server remove them from storage ------------------------------------
-- Deleting a message queues its files in storage_purge_queue (messages.sql). The reminder sender now empties that queue
-- every 5 minutes. This helper also finds files that no message points to any more (for example a failed send).
create or replace function public.orphan_message_files()
returns table (name text) language sql stable security definer set search_path = public, storage as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'message-files'
     and o.created_at < now() - interval '2 days'
     and not exists (select 1 from public.message_attachments a where a.path = o.name)
     and not exists (select 1 from public.storage_purge_queue q where q.path = o.name)
   limit 200;
$$;
revoke all on function public.orphan_message_files() from public, anon, authenticated;
grant execute on function public.orphan_message_files() to service_role;
grant select, delete on public.storage_purge_queue to service_role;

-- 5. See that it works (optional) -----------------------------------------------------------------
select public.purge_old_records() as first_run;
select jobname, schedule, active from cron.job where jobname in ('rco-purge-messages', 'rco-retention', 'rco-send-reminders') order by jobname;
