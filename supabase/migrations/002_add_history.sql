-- supabase/migrations/002_add_history.sql
alter table public.projects add column history jsonb default '[]'::jsonb;
