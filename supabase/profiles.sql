-- Phase 3: soror profiles (photo, title, contact details, school, initiation) + dues placeholder.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run.
-- Contains no member data. Every rostered soror can read every profile; only she (or an officer) can change it.

create or replace function public.my_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.members m
  where m.active and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;
revoke all on function public.my_member_id() from public, anon;
grant execute on function public.my_member_id() to authenticated;

create table if not exists public.profiles (
  member_id         uuid primary key references public.members(id) on delete cascade,
  title             text check (char_length(title) <= 80),
  contact_email     text check (char_length(contact_email) <= 160),
  phone             text check (char_length(phone) <= 40),
  address           text check (char_length(address) <= 240),
  school            text check (char_length(school) <= 120),
  initiation_year   int  check (initiation_year between 1908 and 2100),
  initiated_chapter text check (char_length(initiated_chapter) <= 120),
  photo_file        text check (char_length(photo_file) <= 200),
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

drop policy if exists "profiles: read own"       on public.profiles;
drop policy if exists "profiles: officers read"  on public.profiles;
drop policy if exists "profiles: write own"      on public.profiles;
drop policy if exists "profiles: officers write" on public.profiles;

create policy "profiles: read own" on public.profiles for select to authenticated
  using (member_id = public.my_member_id());
create policy "profiles: officers read" on public.profiles for select to authenticated
  using (public.is_officer());
create policy "profiles: write own" on public.profiles for all to authenticated
  using (member_id = public.my_member_id()) with check (member_id = public.my_member_id());
create policy "profiles: officers write" on public.profiles for all to authenticated
  using (public.is_officer()) with check (public.is_officer());

-- a soror cannot give herself a title; officers set titles
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not public.is_officer() then
    if tg_op = 'INSERT' then new.title := null; else new.title := old.title; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- the whole chapter's profiles, for the directory (name comes from the roster)
create or replace function public.get_profiles()
returns table (member_id uuid, full_name text, title text, contact_email text, phone text,
               address text, school text, initiation_year int, initiated_chapter text, photo_file text)
language sql stable security definer set search_path = public as $$
  select m.id, m.full_name, p.title, p.contact_email, p.phone, p.address, p.school,
         p.initiation_year, p.initiated_chapter, p.photo_file
  from public.members m
  left join public.profiles p on p.member_id = m.id
  where m.active and public.is_member();
$$;
revoke all on function public.get_profiles() from public, anon;
grant execute on function public.get_profiles() to authenticated;

-- a soror may upload and replace only her own picture: portal-files/profiles/<her id>/avatar.jpg
drop policy if exists "portal files: own picture add"     on storage.objects;
drop policy if exists "portal files: own picture replace" on storage.objects;
drop policy if exists "portal files: own picture delete"  on storage.objects;

create policy "portal files: own picture add" on storage.objects for insert to authenticated
  with check (bucket_id = 'portal-files' and (storage.foldername(name))[1] = 'profiles'
              and (storage.foldername(name))[2] = public.my_member_id()::text);
create policy "portal files: own picture replace" on storage.objects for update to authenticated
  using      (bucket_id = 'portal-files' and (storage.foldername(name))[1] = 'profiles'
              and (storage.foldername(name))[2] = public.my_member_id()::text)
  with check (bucket_id = 'portal-files' and (storage.foldername(name))[1] = 'profiles'
              and (storage.foldername(name))[2] = public.my_member_id()::text);
create policy "portal files: own picture delete" on storage.objects for delete to authenticated
  using (bucket_id = 'portal-files' and (storage.foldername(name))[1] = 'profiles'
         and (storage.foldername(name))[2] = public.my_member_id()::text);
