-- Phase 12: Chapter events added by an admin (flyer + details + RSVP info).
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.
--
-- HOW IT WORKS
--   * An admin adds an event in Officer Tools > Events & flyers (title, date, time, place, flyer picture, RSVP link or instructions).
--   * It appears at once on the Events Registration page AND as a slide on the Portal Home announcement board.
--   * Both places hide it the day after the event. It is permanently deleted 7 days after the event date, with its flyer picture
--     (change the 7 in Table Editor > retention_rules > events).
--   * Only admins can add, change or delete events. Every signed-in soror can read them.

-- 1. The events -----------------------------------------------------------------------------------
create table if not exists public.chapter_events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 100),
  event_date   date not null,                                   -- the (last) day of the event
  start_time   text check (start_time is null or start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time     text check (end_time   is null or end_time   ~ '^[0-2][0-9]:[0-5][0-9]$'),
  location     text check (location is null or char_length(location) <= 200),
  description  text check (description is null or char_length(description) <= 600),
  price_text   text check (price_text is null or char_length(price_text) <= 100),
  rsvp_text    text check (rsvp_text is null or char_length(rsvp_text) <= 300),
  rsvp_url     text check (rsvp_url is null or (char_length(rsvp_url) <= 400 and rsvp_url ~* '^https?://')),
  flyer_path   text,                                            -- picture in the public bucket event-flyers
  created_by   uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists chapter_events_date_idx on public.chapter_events (event_date);
alter table public.chapter_events enable row level security;
revoke all on public.chapter_events from anon, authenticated;
grant select, insert, update, delete on public.chapter_events to authenticated;

drop policy if exists "events: members read"  on public.chapter_events;
drop policy if exists "events: admins add"    on public.chapter_events;
drop policy if exists "events: admins change" on public.chapter_events;
drop policy if exists "events: admins delete" on public.chapter_events;
create policy "events: members read"  on public.chapter_events for select to authenticated using (public.is_member());
create policy "events: admins add"    on public.chapter_events for insert to authenticated
  with check (public.is_admin() and created_by = public.my_member_id());
create policy "events: admins change" on public.chapter_events for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "events: admins delete" on public.chapter_events for delete to authenticated using (public.is_admin());

-- 2. Flyer pictures: a public bucket (the pictures are meant to be seen; the RSVP details stay in the table above) ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-flyers', 'event-flyers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event flyers: admins add"    on storage.objects;
drop policy if exists "event flyers: admins remove" on storage.objects;
create policy "event flyers: admins add" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-flyers' and public.is_admin());
create policy "event flyers: admins remove" on storage.objects for delete to authenticated
  using (bucket_id = 'event-flyers' and public.is_admin());

-- 3. When an event is deleted (by hand or by the clean-up), queue its flyer picture for removal -----------------------
alter table public.storage_purge_queue add column if not exists bucket text not null default 'message-files';

create or replace function public.chapter_events_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.flyer_path is not null then
    insert into public.storage_purge_queue (path, bucket) values (old.flyer_path, 'event-flyers') on conflict do nothing;
  end if;
  return old;
end $$;
drop trigger if exists chapter_events_after_delete on public.chapter_events;
create trigger chapter_events_after_delete after delete on public.chapter_events
  for each row execute function public.chapter_events_after_delete();

-- 4. Nightly clean-up: delete 7 days after the event date ----------------------------------------------------------
insert into public.retention_rules (key, keep_days, note) values
  ('events', 7, 'Admin-added events and their flyers, counted from the event date')
on conflict (key) do nothing;

create or replace function public.purge_events()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.chapter_events where event_date < current_date - public.retention_days('events', 7);
  get diagnostics n = row_count;
  return jsonb_build_object('deleted', n);
end $$;
revoke all on function public.purge_events() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('rco-events', '52 3 * * *', 'select public.purge_events()');

-- 5. Check (optional): both should say true
select (select count(*) from storage.buckets where id = 'event-flyers') = 1 as flyer_bucket_ready,
       (select count(*) from cron.job where jobname = 'rco-events') = 1 as nightly_cleanup_ready;
