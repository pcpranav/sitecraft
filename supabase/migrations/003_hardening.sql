-- Hardening: profile deletion (GDPR), email index, rate-limit reset helper.

-- 1. Allow users to delete their own profile (cascades to projects/generations via FK).
create policy "Users can delete own profile"
  on public.profiles for delete using (auth.uid() = id);

-- 2. Index for email lookups.
create index if not exists idx_profiles_email on public.profiles(email);

-- 3. Index generations.model for analytics filtering.
create index if not exists idx_generations_model on public.generations(model);

-- 4. Atomic rate-limit increment used by /api/ai. Returns the new count
--    after resetting the window if older than `window_seconds`.
create or replace function public.increment_rate_limit(
  p_user_id uuid,
  p_window_seconds int default 3600
)
returns int as $$
declare
  v_count int;
begin
  insert into public.rate_limits (user_id, count, window_start)
    values (p_user_id, 1, now())
  on conflict (user_id) do update
    set count = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.rate_limits.window_start
        end
    returning count into v_count;
  return v_count;
end;
$$ language plpgsql security definer;
