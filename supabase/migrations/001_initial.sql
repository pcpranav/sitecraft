-- ============================================================================
-- Sitecraft / Webcraft Studio — Supabase Schema
-- ============================================================================

-- 1. PROFILES — extends Supabase auth.users
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. PROJECTS — saved website projects
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Untitled',
  description text default '',
  pages       jsonb not null default '{}',
  shared_css  text default '',
  shared_js   text default '',
  thumbnail   text default '',
  is_deployed boolean default false,
  deploy_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index idx_projects_user on public.projects(user_id);
create index idx_projects_updated on public.projects(updated_at desc);

alter table public.projects enable row level security;

create policy "Users can read own projects"
  on public.projects for select using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete using (auth.uid() = user_id);


-- 3. GENERATIONS — AI generation history + token tracking
create table public.generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete set null,
  prompt        text not null,
  provider      text not null,
  model         text not null,
  input_tokens  int default 0,
  output_tokens int default 0,
  created_at    timestamptz default now()
);

create index idx_generations_user on public.generations(user_id);
create index idx_generations_project on public.generations(project_id);
create index idx_generations_created on public.generations(created_at desc);

alter table public.generations enable row level security;

create policy "Users can read own generations"
  on public.generations for select using (auth.uid() = user_id);

create policy "Users can insert own generations"
  on public.generations for insert with check (auth.uid() = user_id);


-- 4. RATE_LIMITS — persistent per-user rate limiting
create table public.rate_limits (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  count       int default 0,
  window_start timestamptz default now()
);

alter table public.rate_limits enable row level security;

-- Only server-side (service role) accesses rate_limits — no client policies needed.
-- The serverless functions use the service role key.


-- 5. Helper: updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- 6. Views for convenience

-- User's total token usage (last 30 days)
create or replace view public.user_token_usage as
select
  user_id,
  coalesce(sum(input_tokens + output_tokens), 0) as total_tokens,
  count(*) as generation_count
from public.generations
where created_at > now() - interval '30 days'
group by user_id;
