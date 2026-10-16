-- Phase 6: the home page gallery, managed by officers and admins (12 photos at most).
-- Photos are public on purpose (the gallery is on the public home page); only officers and admins can change them.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.

create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  path        text,                       -- file in the public "gallery" bucket
  static_url  text,                       -- or a file that ships with the site (the original photos)
  caption     text not null check (char_length(caption) <= 80),
  sub         text check (char_length(sub) <= 120),
  position    int  not null default 0,    -- smaller = earlier in the carousel
  created_at  timestamptz not null default now(),
  created_by  uuid references public.members(id) on delete set null,
  constraint gallery_has_photo check (path is not null or static_url is not null)
);

alter table public.gallery_items enable row level security;
revoke all on public.gallery_items from anon, authenticated;
grant select on public.gallery_items to anon, authenticated;
grant insert, update, delete on public.gallery_items to authenticated;

drop policy if exists "gallery: anyone can view"   on public.gallery_items;
drop policy if exists "gallery: officers add"      on public.gallery_items;
drop policy if exists "gallery: officers edit"     on public.gallery_items;
drop policy if exists "gallery: officers delete"   on public.gallery_items;
create policy "gallery: anyone can view" on public.gallery_items for select to anon, authenticated using (true);
create policy "gallery: officers add"    on public.gallery_items for insert to authenticated with check (public.is_officer());
create policy "gallery: officers edit"   on public.gallery_items for update to authenticated using (public.is_officer()) with check (public.is_officer());
create policy "gallery: officers delete" on public.gallery_items for delete to authenticated using (public.is_officer());

-- never more than 12 photos
create or replace function public.gallery_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.gallery_items) >= 12 then
    raise exception 'The gallery holds 12 photos. Remove one first.';
  end if;
  return new;
end $$;
drop trigger if exists gallery_limit on public.gallery_items;
create trigger gallery_limit before insert on public.gallery_items
  for each row execute function public.gallery_limit();

-- the public bucket for new photos (5 MB each, pictures only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gallery files: officers add"    on storage.objects;
drop policy if exists "gallery files: officers change" on storage.objects;
drop policy if exists "gallery files: officers remove" on storage.objects;
create policy "gallery files: officers add"    on storage.objects for insert to authenticated with check (bucket_id = 'gallery' and public.is_officer());
create policy "gallery files: officers change" on storage.objects for update to authenticated using (bucket_id = 'gallery' and public.is_officer()) with check (bucket_id = 'gallery' and public.is_officer());
create policy "gallery files: officers remove" on storage.objects for delete to authenticated using (bucket_id = 'gallery' and public.is_officer());

-- the five photos already on the site, so the gallery is not empty (only when the table is empty)
insert into public.gallery_items (static_url, caption, sub, position)
select v.url, v.caption, v.sub, v.pos from (values
  ('images/gallery/award-recipients-2025.jpg', 'Award Recipients', '2025 Chapter Awards', 1),
  ('images/gallery/servant-leadership-award-soror-bobbie-terry.jpg', 'Servant Leadership Award', 'Soror Bobbie Terry, 2025', 2),
  ('images/gallery/soror-of-the-day.jpg', 'Soror of the Day', 'Soror Kassel Kendricks', 3),
  ('images/gallery/fellowship-dinner.jpg', 'Fellowship Dinner', 'Rho Chi Omega Chapter', 4),
  ('images/gallery/newly-transferred-sorors.jpg', 'Newly Transferred Sorors', 'Welcome to Rho Chi Omega', 5)
) as v(url, caption, sub, pos)
where not exists (select 1 from public.gallery_items);
