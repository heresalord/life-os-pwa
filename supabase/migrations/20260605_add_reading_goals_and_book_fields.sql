-- Add new fields to books table
alter table books
add column if not exists genre text,
add column if not exists isbn text,
add column if not exists language text,
add column if not exists source text check (source in ('physical', 'ebook', 'audiobook', 'library')),
add column if not exists reading_sessions jsonb default '[]'::jsonb,
add column if not exists shelves jsonb default '[]'::jsonb;

-- Create reading_goals table
create table if not exists reading_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  target_books integer not null,
  target_pages integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, year)
);

-- Enable RLS and create policy for reading_goals
alter table reading_goals enable row level security;

create policy "Users access own reading goals" on reading_goals
  for all using (auth.uid() = user_id);
