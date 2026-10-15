-- Phase 3b: link each directory card to a roster entry (exact, not by name).
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run.

alter table public.directory
  add column if not exists member_id uuid references public.members(id) on delete set null;
create unique index if not exists directory_member_unique on public.directory (member_id) where member_id is not null;

-- link one roster entry to the directory card with the same name (if that card is still unlinked)
create or replace function public.link_directory_for(mid uuid)
returns void language sql security definer set search_path = public as $$
  update public.directory
  set member_id = mid
  where id = (
    select d.id from public.directory d
    join public.members m on m.id = mid
    where d.member_id is null
      and lower(trim(d.display_name)) = lower(trim(coalesce(m.full_name, '')))
    limit 1)
  and not exists (select 1 from public.directory x where x.member_id = mid);
$$;
revoke all on function public.link_directory_for(uuid) from public, anon, authenticated;

-- whenever a soror is added to the roster, or her name is fixed, try to link her card
create or replace function public.members_link_directory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.link_directory_for(new.id);
  return new;
end $$;
drop trigger if exists members_link_directory on public.members;
create trigger members_link_directory after insert or update of full_name on public.members
  for each row execute function public.members_link_directory();

-- link everyone already on the roster
select public.link_directory_for(id) from public.members;
