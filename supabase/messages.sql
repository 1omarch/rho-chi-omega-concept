-- Phase 4: private messages and group chats between sorors.
--  * Only people in a conversation can read it. Admins can review only through logged functions.
--  * Messages are destroyed 30 days after they are sent. A message a soror deletes sits in her Trash for 30 days.
--  * A reported message is kept until an admin resolves the report.
--  * Attachments live in a private bucket (10 MB each) and are removed when their message is destroyed.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run.
-- Contains no member data.

-- 1. Tables ----------------------------------------------------------------------
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  title            text check (char_length(title) <= 80),
  is_group         boolean not null default false,
  created_by       uuid references public.members(id) on delete set null,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  member_id        uuid not null references public.members(id) on delete cascade,
  last_read_at     timestamptz not null default now(),
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, member_id)
);
create index if not exists conversation_members_member on public.conversation_members (member_id);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid references public.members(id) on delete set null,
  body             text not null default '' check (char_length(body) <= 4000),
  created_at       timestamptz not null default now()
);
create index if not exists messages_conversation_created on public.messages (conversation_id, created_at);
create index if not exists messages_created on public.messages (created_at);

create table if not exists public.message_attachments (
  id               uuid primary key default gen_random_uuid(),
  message_id       uuid not null references public.messages(id) on delete cascade,
  path             text not null,
  file_name        text not null check (char_length(file_name) <= 200),
  mime_type        text,
  size_bytes       int
);
create index if not exists message_attachments_message on public.message_attachments (message_id);

-- "delete for me": the message moves to her Trash for 30 days
create table if not exists public.message_deletions (
  message_id       uuid not null references public.messages(id) on delete cascade,
  member_id        uuid not null references public.members(id) on delete cascade,
  deleted_at       timestamptz not null default now(),
  primary key (message_id, member_id)
);

create table if not exists public.message_reports (
  id               uuid primary key default gen_random_uuid(),
  message_id       uuid not null references public.messages(id) on delete cascade,
  reporter_id      uuid references public.members(id) on delete set null,
  reason           text check (char_length(reason) <= 500),
  handled          boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (message_id, reporter_id)
);

-- every time an admin opens someone's conversation, it is written down
create table if not exists public.message_review_log (
  id               bigserial primary key,
  admin_id         uuid references public.members(id) on delete set null,
  conversation_id  uuid,
  action           text not null,
  at               timestamptz not null default now()
);

-- files waiting to be removed from storage after their message was destroyed
create table if not exists public.storage_purge_queue (
  path             text primary key,
  queued_at        timestamptz not null default now()
);

alter table public.conversations         enable row level security;
alter table public.conversation_members  enable row level security;
alter table public.messages              enable row level security;
alter table public.message_attachments   enable row level security;
alter table public.message_deletions     enable row level security;
alter table public.message_reports       enable row level security;
alter table public.message_review_log    enable row level security;
alter table public.storage_purge_queue   enable row level security;

revoke all on public.conversations, public.conversation_members, public.messages, public.message_attachments,
              public.message_deletions, public.message_reports, public.message_review_log,
              public.storage_purge_queue from anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages, public.message_attachments to authenticated;
grant insert on public.messages, public.message_attachments to authenticated;
grant select, insert, delete on public.message_deletions to authenticated;
grant select, delete on public.storage_purge_queue to authenticated;

-- 2. Helper: am I in this conversation? ---------------------------------------------
create or replace function public.in_conversation(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member() and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = cid and cm.member_id = public.my_member_id());
$$;
revoke all on function public.in_conversation(uuid) from public, anon;
grant execute on function public.in_conversation(uuid) to authenticated;

-- 3. Row rules ------------------------------------------------------------------------
drop policy if exists "conversations: mine"        on public.conversations;
drop policy if exists "conv members: same chat"    on public.conversation_members;
drop policy if exists "messages: read mine"        on public.messages;
drop policy if exists "messages: send"             on public.messages;
drop policy if exists "attachments: read mine"     on public.message_attachments;
drop policy if exists "attachments: add to mine"   on public.message_attachments;
drop policy if exists "deletions: own read"        on public.message_deletions;
drop policy if exists "deletions: own add"         on public.message_deletions;
drop policy if exists "deletions: own restore"     on public.message_deletions;
drop policy if exists "purge queue: members read"  on public.storage_purge_queue;
drop policy if exists "purge queue: members clear" on public.storage_purge_queue;

create policy "conversations: mine" on public.conversations for select to authenticated
  using (public.in_conversation(id));
create policy "conv members: same chat" on public.conversation_members for select to authenticated
  using (public.in_conversation(conversation_id));
create policy "messages: read mine" on public.messages for select to authenticated
  using (public.in_conversation(conversation_id));
create policy "messages: send" on public.messages for insert to authenticated
  with check (sender_id = public.my_member_id() and public.in_conversation(conversation_id));
create policy "attachments: read mine" on public.message_attachments for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.in_conversation(m.conversation_id)));
create policy "attachments: add to mine" on public.message_attachments for insert to authenticated
  with check (exists (select 1 from public.messages m where m.id = message_id and m.sender_id = public.my_member_id()));
create policy "deletions: own read" on public.message_deletions for select to authenticated
  using (member_id = public.my_member_id());
create policy "deletions: own add" on public.message_deletions for insert to authenticated
  with check (member_id = public.my_member_id()
              and exists (select 1 from public.messages m where m.id = message_id and public.in_conversation(m.conversation_id)));
create policy "deletions: own restore" on public.message_deletions for delete to authenticated
  using (member_id = public.my_member_id() and deleted_at > now() - interval '30 days');
create policy "purge queue: members read"  on public.storage_purge_queue for select to authenticated using (public.is_member());
create policy "purge queue: members clear" on public.storage_purge_queue for delete to authenticated using (public.is_member());

-- 4. Triggers: slow down floods, keep the chat list ordered ---------------------------
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too quickly. Please wait a moment.';
  end if;
  return new;
end $$;
drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and member_id = new.sender_id;
  return new;
end $$;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.attachments_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.storage_purge_queue (path) values (old.path) on conflict do nothing;
  return old;
end $$;
drop trigger if exists attachments_after_delete on public.message_attachments;
create trigger attachments_after_delete after delete on public.message_attachments
  for each row execute function public.attachments_after_delete();

-- 5. Functions the portal calls ----------------------------------------------------------
-- start (or reopen) a conversation with one or more sorors
create or replace function public.start_conversation(member_ids uuid[], chat_title text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_member_id();
  others uuid[];
  cid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select coalesce(array_agg(distinct m.id), '{}') into others
    from public.members m where m.id = any(member_ids) and m.active and m.id <> me;
  if coalesce(array_length(others, 1), 0) = 0 then raise exception 'Choose at least one soror'; end if;
  if array_length(others, 1) > 60 then raise exception 'A chat can have at most 60 sorors'; end if;

  if array_length(others, 1) = 1 and coalesce(trim(chat_title), '') = '' then
    -- one-to-one: reuse the existing chat if there is one
    select c.id into cid
      from public.conversations c
      where not c.is_group
        and exists (select 1 from public.conversation_members x where x.conversation_id = c.id and x.member_id = me)
        and exists (select 1 from public.conversation_members x where x.conversation_id = c.id and x.member_id = others[1])
        and (select count(*) from public.conversation_members x where x.conversation_id = c.id) = 2
      limit 1;
    if cid is not null then return cid; end if;
  end if;

  insert into public.conversations (title, is_group, created_by)
    values (nullif(trim(chat_title), ''), array_length(others, 1) > 1 or coalesce(trim(chat_title), '') <> '', me)
    returning id into cid;
  insert into public.conversation_members (conversation_id, member_id)
    select cid, x from unnest(others || me) as x;
  return cid;
end $$;

-- the person who started a group chat can add more sorors
create or replace function public.add_conversation_members(cid uuid, member_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.conversations c where c.id = cid and c.is_group and c.created_by = public.my_member_id()) then
    raise exception 'Only the person who started this group can add sorors';
  end if;
  if (select count(*) from public.conversation_members where conversation_id = cid) + coalesce(array_length(member_ids, 1), 0) > 60 then
    raise exception 'A chat can have at most 60 sorors';
  end if;
  insert into public.conversation_members (conversation_id, member_id)
    select cid, m.id from public.members m where m.id = any(member_ids) and m.active
    on conflict do nothing;
end $$;

create or replace function public.mark_read(cid uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = cid and member_id = public.my_member_id();
$$;

create or replace function public.unread_total()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(count(*), 0)::int
  from public.conversation_members cm
  join public.messages m on m.conversation_id = cm.conversation_id
  where cm.member_id = public.my_member_id() and public.is_member()
    and m.sender_id is distinct from cm.member_id
    and m.created_at > cm.last_read_at
    and not exists (select 1 from public.message_deletions d where d.message_id = m.id and d.member_id = cm.member_id);
$$;

create or replace function public.list_conversations()
returns table (id uuid, title text, is_group boolean, created_by uuid, last_message_at timestamptz,
               unread int, preview text, participants jsonb)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.is_group, c.created_by, c.last_message_at,
    (select count(*)::int from public.messages m
       where m.conversation_id = c.id and m.sender_id is distinct from cm.member_id and m.created_at > cm.last_read_at
         and not exists (select 1 from public.message_deletions d where d.message_id = m.id and d.member_id = cm.member_id)),
    (select coalesce(nullif(left(m.body, 120), ''), 'Attachment') from public.messages m
       where m.conversation_id = c.id
         and not exists (select 1 from public.message_deletions d where d.message_id = m.id and d.member_id = cm.member_id)
       order by m.created_at desc limit 1),
    (select jsonb_agg(jsonb_build_object('id', x.member_id, 'name', coalesce(mm.full_name, mm.email)) order by mm.full_name)
       from public.conversation_members x join public.members mm on mm.id = x.member_id
       where x.conversation_id = c.id)
  from public.conversations c
  join public.conversation_members cm on cm.conversation_id = c.id and cm.member_id = public.my_member_id()
  where public.is_member()
  order by c.last_message_at desc;
$$;

create or replace function public.report_message(mid uuid, why text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_member_id();
begin
  if not exists (select 1 from public.messages m where m.id = mid and public.in_conversation(m.conversation_id)) then
    raise exception 'Message not found';
  end if;
  insert into public.message_reports (message_id, reporter_id, reason) values (mid, me, left(why, 500))
  on conflict (message_id, reporter_id) do nothing;
end $$;

-- 6. Admin review (logged) ----------------------------------------------------------------
create or replace function public.admin_reports()
returns table (report_id uuid, reason text, handled boolean, reported_at timestamptz, message_id uuid, conversation_id uuid,
               body text, sent_at timestamptz, sender_name text, reporter_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into public.message_review_log (admin_id, action) values (public.my_member_id(), 'viewed reports');
  return query
    select r.id, r.reason, r.handled, r.created_at, m.id, m.conversation_id, m.body, m.created_at,
           coalesce(s.full_name, s.email), coalesce(rp.full_name, rp.email)
    from public.message_reports r
    join public.messages m on m.id = r.message_id
    left join public.members s on s.id = m.sender_id
    left join public.members rp on rp.id = r.reporter_id
    order by r.handled, r.created_at desc;
end $$;

create or replace function public.admin_resolve_report(rid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.message_reports set handled = true where id = rid;
  insert into public.message_review_log (admin_id, action) values (public.my_member_id(), 'resolved a report');
end $$;

create or replace function public.admin_find_conversations(mid uuid)
returns table (id uuid, title text, is_group boolean, last_message_at timestamptz, participants jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into public.message_review_log (admin_id, action) values (public.my_member_id(), 'looked up conversations');
  return query
    select c.id, c.title, c.is_group, c.last_message_at,
      (select jsonb_agg(jsonb_build_object('id', x.member_id, 'name', coalesce(mm.full_name, mm.email)) order by mm.full_name)
         from public.conversation_members x join public.members mm on mm.id = x.member_id where x.conversation_id = c.id)
    from public.conversations c
    where exists (select 1 from public.conversation_members x where x.conversation_id = c.id and x.member_id = mid)
    order by c.last_message_at desc;
end $$;

create or replace function public.admin_read_conversation(cid uuid)
returns table (id uuid, sender_name text, body text, created_at timestamptz, attachments jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into public.message_review_log (admin_id, conversation_id, action) values (public.my_member_id(), cid, 'read conversation');
  return query
    select m.id, coalesce(s.full_name, s.email, 'Former member'), m.body, m.created_at,
      (select coalesce(jsonb_agg(jsonb_build_object('path', a.path, 'name', a.file_name)), '[]'::jsonb)
         from public.message_attachments a where a.message_id = m.id)
    from public.messages m left join public.members s on s.id = m.sender_id
    where m.conversation_id = cid order by m.created_at;
end $$;

create or replace function public.admin_review_log()
returns table (at timestamptz, admin_name text, action text, conversation_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select l.at, coalesce(a.full_name, a.email), l.action, l.conversation_id
    from public.message_review_log l left join public.members a on a.id = l.admin_id
    order by l.at desc limit 100;
end $$;

-- 7. Retention: destroy messages after 30 days ----------------------------------------------
create or replace function public.purge_messages()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- sent more than 30 days ago (unless an unresolved report needs it)
  delete from public.messages m
  where m.created_at < now() - interval '30 days'
    and not exists (select 1 from public.message_reports r where r.message_id = m.id and not r.handled);

  -- every person in the chat has had it in Trash for 30 days
  delete from public.messages m
  where not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = m.conversation_id
      and not exists (select 1 from public.message_deletions d
                      where d.message_id = m.id and d.member_id = cm.member_id and d.deleted_at < now() - interval '30 days'))
    and not exists (select 1 from public.message_reports r where r.message_id = m.id and not r.handled);

  -- empty, old chats
  delete from public.conversations c
  where c.created_at < now() - interval '30 days'
    and not exists (select 1 from public.messages m where m.conversation_id = c.id);

  -- old log lines
  delete from public.message_review_log where at < now() - interval '1 year';
end $$;

revoke all on function public.start_conversation(uuid[], text), public.add_conversation_members(uuid, uuid[]),
  public.mark_read(uuid), public.unread_total(), public.list_conversations(), public.report_message(uuid, text),
  public.admin_reports(), public.admin_resolve_report(uuid), public.admin_find_conversations(uuid),
  public.admin_read_conversation(uuid), public.admin_review_log(), public.purge_messages()
  from public, anon;
grant execute on function public.start_conversation(uuid[], text), public.add_conversation_members(uuid, uuid[]),
  public.mark_read(uuid), public.unread_total(), public.list_conversations(), public.report_message(uuid, text),
  public.admin_reports(), public.admin_resolve_report(uuid), public.admin_find_conversations(uuid),
  public.admin_read_conversation(uuid), public.admin_review_log()
  to authenticated;

-- 8. Attachment storage (private bucket) ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-files', 'message-files', false, 10485760, array[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','application/pdf',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "message files: read"   on storage.objects;
drop policy if exists "message files: upload" on storage.objects;
drop policy if exists "message files: sweep"  on storage.objects;

create policy "message files: read" on storage.objects for select to authenticated
  using (bucket_id = 'message-files' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         then (public.in_conversation(((storage.foldername(name))[1])::uuid) or public.is_admin()) else false end);
create policy "message files: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-files' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         then public.in_conversation(((storage.foldername(name))[1])::uuid) else false end);
-- files can only be removed once their message has been destroyed (their path is in the queue)
create policy "message files: sweep" on storage.objects for delete to authenticated
  using (bucket_id = 'message-files' and exists (select 1 from public.storage_purge_queue q where q.path = name));

-- 9. Live updates (so a new message shows up without refreshing) ------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
