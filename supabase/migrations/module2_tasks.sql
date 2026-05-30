create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  description text,
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;
create policy "Users access own projects" on projects for all using (auth.uid() = user_id);

alter table tasks
add column if not exists due_date date,
add column if not exists description text,
add column if not exists tags jsonb default '[]',
add column if not exists subtasks jsonb default '[]',
add column if not exists kanban_status text default 'todo' check (kanban_status in ('backlog', 'todo', 'in_progress', 'done')),
add column if not exists project_id uuid references projects(id) on delete set null,
add column if not exists time_block_start time,
add column if not exists time_block_end time;
