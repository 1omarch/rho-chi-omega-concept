-- Phase 10: voice notes in Messages.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run. Safe to re-run. Contains no member data.
-- Voice notes are .wav files kept in the same private "message-files" bucket as other attachments, so they follow the same
-- rules: only people in the conversation can hear them, and they are permanently deleted 30 days after they are sent.
-- A 2-minute voice note is about 3.8 MB, well under the bucket's 10 MB limit per file.

update storage.buckets
   set allowed_mime_types = (
         select array_agg(distinct t)
           from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['audio/wav', 'audio/x-wav']) as t)
 where id = 'message-files';

select id, file_size_limit, allowed_mime_types from storage.buckets where id = 'message-files';
