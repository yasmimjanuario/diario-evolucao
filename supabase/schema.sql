-- Evolua — schema inicial
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  birth_date date,
  sex text check (sex in ('female', 'male', 'other')),
  height_cm numeric(5,2) check (height_cm > 0),
  current_weight_kg numeric(6,2) check (current_weight_kg > 0),
  goal_weight_kg numeric(6,2) check (goal_weight_kg > 0),
  activity_level text not null default 'low' check (activity_level in ('low', 'light', 'moderate', 'high')),
  equipment text[] not null default '{}',
  limitations text not null default '',
  water_goal_ml integer not null default 2000 check (water_goal_ml between 250 and 10000),
  protein_goal_g integer not null default 100 check (protein_goal_g between 10 and 500),
  weekly_exercise_minutes integer not null default 150 check (weekly_exercise_minutes between 10 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migração segura para projetos que já executaram uma versão anterior do schema.
alter table public.profiles add column if not exists protein_goal_g integer not null default 100;
alter table public.profiles add column if not exists weekly_exercise_minutes integer not null default 150;

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  weight_kg numeric(6,2) not null check (weight_kg > 0),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  amount_ml integer not null default 0 check (amount_ml >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null default current_date,
  name text not null,
  protein_g numeric(6,2) not null default 0 check (protein_g >= 0),
  calories integer not null default 0 check (calories >= 0),
  consumed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  level text not null default 'adaptation',
  exercises jsonb not null default '[]'::jsonb,
  generation_context jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  calories_burned integer not null default 0 check (calories_burned >= 0),
  completed_exercises integer not null default 0,
  exercise_logs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  goal_type text not null check (goal_type in ('workouts', 'water', 'meals', 'protein', 'weight')),
  target_value numeric(8,2) not null check (target_value > 0),
  current_value numeric(8,2) not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, week_start, goal_type)
);

create table if not exists public.badges (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  rule jsonb not null default '{}'::jsonb
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

insert into public.badges (id, title, description, icon, rule) values
  ('first-step', 'Primeiro passo', 'Fez o primeiro registro', '🌱', '{"records": 1}'),
  ('hydrated', 'Hidratada', 'Bateu a meta de água 3 vezes', '💧', '{"water_goal_days": 3}'),
  ('moving', 'Em movimento', 'Registrou atividade por 5 dias', '🔥', '{"active_days": 5}'),
  ('balanced-week', 'Semana equilibrada', 'Concluiu todas as metas da semana', '⭐', '{"weekly_goals": "all"}')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  rule = excluded.rule;

-- Cria o perfil mínimo junto com o usuário autenticado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: cada pessoa acessa somente os próprios dados.
alter table public.profiles enable row level security;
alter table public.weight_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.meal_logs enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.user_badges enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own weights" on public.weight_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own water" on public.water_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meals" on public.meal_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plans" on public.workout_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions" on public.workout_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on public.weekly_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own earned badges" on public.user_badges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Catálogo de medalhas pode ser lido por pessoas autenticadas.
alter table public.badges enable row level security;
create policy "authenticated can read badges" on public.badges for select to authenticated using (true);

create index if not exists weight_logs_user_date_idx on public.weight_logs (user_id, logged_on desc);
create index if not exists water_logs_user_date_idx on public.water_logs (user_id, logged_on desc);
create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, logged_on desc);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions (user_id, started_at desc);
