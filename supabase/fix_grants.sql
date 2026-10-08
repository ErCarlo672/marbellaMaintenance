-- Fix: tables created via SQL Editor don't automatically get the
-- baseline table-level grants Supabase's own UI would add. Row Level
-- Security policies control *which rows* a role can touch, but Postgres
-- still blocks everything by default unless the role also has a GRANT
-- on the table itself. Run this once.

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

grant select on public.maintenance_records to authenticated;

grant select, insert on public.messages to authenticated;

grant insert on public.booking_requests to anon, authenticated;

grant insert on public.contact_messages to anon, authenticated;
