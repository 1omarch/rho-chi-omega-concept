-- Phase 4b: run the 30-day clean-up every night at about 3:23 AM.
-- Run AFTER messages.sql. If this says pg_cron is not available, open Database > Extensions in Supabase,
-- switch on "pg_cron", then run it again. Safe to re-run.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('rco-purge-messages', '23 3 * * *', 'select public.purge_messages()');
