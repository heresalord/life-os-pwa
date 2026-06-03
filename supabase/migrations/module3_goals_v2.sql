-- Upgrade Goals Table
alter table goals add column if not exists tracker_type text default 'target' check (tracker_type in ('target', 'habit', 'average', 'project'));
alter table goals add column if not exists category text;
alter table goals add column if not exists habit_schedule jsonb default '{"frequency": "daily", "days": []}'::jsonb;
alter table goals add column if not exists habit_streak integer default 0;
alter table goals add column if not exists last_checkin date;

-- Create Habit Logs Table
create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  date date not null,
  value numeric(14,2) not null default 1,
  note text,
  created_at timestamptz default now(),
  unique (goal_id, date)
);

create index if not exists habit_logs_goal_id_idx on habit_logs(goal_id);
create index if not exists habit_logs_user_id_date_idx on habit_logs(user_id, date);

alter table habit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'habit_logs' and policyname = 'Users access own habit logs'
  ) then
    create policy "Users access own habit logs" on habit_logs for all using (auth.uid() = user_id);
  end if;
end
$$;

-- Create Milestones Table
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists milestones_goal_id_idx on milestones(goal_id);
create index if not exists milestones_user_id_idx on milestones(user_id);

alter table milestones enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'milestones' and policyname = 'Users access own milestones'
  ) then
    create policy "Users access own milestones" on milestones for all using (auth.uid() = user_id);
  end if;
end
$$;
