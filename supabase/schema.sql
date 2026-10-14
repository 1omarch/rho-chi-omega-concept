-- Rho Chi Omega portal: roster, roles, and private file storage.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run.
-- Safe to re-run. Contains no private data; the roster itself lives only in your database.

-- 1. The roster: who is allowed into the portal ---------------------------------
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  full_name   text,
  role        text not null default 'member' check (role in ('member', 'officer', 'admin')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint members_email_lowercase check (email = lower(email)),
  constraint members_email_unique unique (email)
);

alter table public.members enable row level security;
revoke all on public.members from anon;
grant select, insert, update, delete on public.members to authenticated;

-- 2. Who is the signed-in person? (the check always uses the verified sign-in email)
create or replace function public.current_member_role()
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.members m
  where m.active and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_member_role() is not null;
$$;

create or replace function public.is_officer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_member_role() in ('officer', 'admin'), false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_member_role() = 'admin', false);
$$;

-- what the portal asks right after sign-in: "am I on the roster, and as what?"
create or replace function public.my_membership()
returns table (full_name text, role text)
language sql stable security definer set search_path = public as $$
  select m.full_name, m.role from public.members m
  where m.active and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

revoke all on function public.current_member_role() from public, anon;
revoke all on function public.is_member()           from public, anon;
revoke all on function public.is_officer()          from public, anon;
revoke all on function public.is_admin()            from public, anon;
revoke all on function public.my_membership()       from public, anon;
grant execute on function public.current_member_role() to authenticated;
grant execute on function public.is_member()           to authenticated;
grant execute on function public.is_officer()          to authenticated;
grant execute on function public.is_admin()            to authenticated;
grant execute on function public.my_membership()       to authenticated;

-- 3. Roster rules ----------------------------------------------------------------
drop policy if exists "roster: read own row"      on public.members;
drop policy if exists "roster: officers read all" on public.members;
drop policy if exists "roster: officers add"      on public.members;
drop policy if exists "roster: officers edit"     on public.members;
drop policy if exists "roster: admins delete"     on public.members;

-- a soror can see only her own row
create policy "roster: read own row" on public.members for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- officers see the whole roster
create policy "roster: officers read all" on public.members for select to authenticated
  using (public.is_officer());

-- officers can add or edit regular sorors; only admins can create or change officers/admins
create policy "roster: officers add" on public.members for insert to authenticated
  with check (public.is_admin() or (public.is_officer() and role = 'member'));

create policy "roster: officers edit" on public.members for update to authenticated
  using      (public.is_admin() or (public.is_officer() and role = 'member'))
  with check (public.is_admin() or (public.is_officer() and role = 'member'));

-- only admins can remove a row (officers deactivate instead)
create policy "roster: admins delete" on public.members for delete to authenticated
  using (public.is_admin());

-- 4. Private file storage --------------------------------------------------------
-- bucket is NOT public: files open only through short-lived signed links for rostered sorors.
insert into storage.buckets (id, name, public)
values ('portal-files', 'portal-files', false)
on conflict (id) do nothing;

drop policy if exists "portal files: members read"     on storage.objects;
drop policy if exists "portal files: officers upload"  on storage.objects;
drop policy if exists "portal files: officers replace" on storage.objects;
drop policy if exists "portal files: officers delete"  on storage.objects;

-- any rostered soror can read files, except the officers-only folder
create policy "portal files: members read" on storage.objects for select to authenticated
  using (
    bucket_id = 'portal-files'
    and public.is_member()
    and ((storage.foldername(name))[1] <> 'officers-only' or public.is_officer())
  );

create policy "portal files: officers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'portal-files' and public.is_officer());

create policy "portal files: officers replace" on storage.objects for update to authenticated
  using      (bucket_id = 'portal-files' and public.is_officer())
  with check (bucket_id = 'portal-files' and public.is_officer());

create policy "portal files: officers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'portal-files' and public.is_officer());
