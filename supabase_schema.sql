-- Phase 1: Complete Supabase Schema for Life OS

-- ========================================================
-- 1. USER PROFILES
-- ========================================================
create table user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone     text not null default 'UTC',
  onboarded    boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table user_profiles enable row level security;
create policy "Users access own profile" on user_profiles
  for all using (auth.uid() = id);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ========================================================
-- 2. USER SETTINGS
-- ========================================================
create table user_settings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade unique,
  currency              text default 'USD',
  daily_budget          numeric(10,2) default 100.00,
  expense_categories    text[] default array['food','coffee','transport','entertainment','utilities','health','shopping','personal','other'],
  income_categories     text[] default array['salary','freelance','business','investment','gift','refund','bonus','other'],
  category_budgets      jsonb default '{}',
  theme                 text default 'dark',
  morning_reminder_time time,
  night_reminder_time   time,
  notifications_enabled boolean default false,
  updated_at            timestamptz default now()
);

alter table user_settings enable row level security;
create policy "Users access own settings" on user_settings
  for all using (auth.uid() = user_id);

-- ========================================================
-- 3. DAILY RECORDS
-- ========================================================
create table daily_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  mood        smallint check (mood between 1 and 5),
  intent      text,
  reflections jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, date)
);

alter table daily_records enable row level security;
create policy "Users access own daily records" on daily_records
  for all using (auth.uid() = user_id);

-- ========================================================
-- 4. TASKS
-- ========================================================
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  title         text not null,
  completed     boolean default false,
  skipped       boolean default false,
  priority      smallint check (priority between 1 and 5),
  completed_at  timestamptz,
  skipped_at    timestamptz,
  carried_from  date,
  from_inbox_id uuid,
  created_at    timestamptz default now()
);

create index on tasks(user_id, date);
alter table tasks enable row level security;
create policy "Users access own tasks" on tasks
  for all using (auth.uid() = user_id);

-- ========================================================
-- 5. TRANSACTIONS
-- ========================================================
create table transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  type        text not null check (type in ('expense', 'income')),
  amount      numeric(12,2) not null check (amount > 0),
  category    text not null,
  method      text not null,
  description text,
  created_at  timestamptz default now()
);

create index on transactions(user_id, date);
create index on transactions(user_id, type, date);
alter table transactions enable row level security;
create policy "Users access own transactions" on transactions
  for all using (auth.uid() = user_id);

-- ========================================================
-- 6. GOALS & EVENTS
-- ========================================================
create table goals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  goal_type        text not null check (goal_type in ('year', 'general', 'binary')),
  measurement_type text not null check (measurement_type in ('count', 'currency', 'time', 'percentage', 'binary')),
  target           numeric(14,2),
  currency         text,
  start_date       date,
  end_date         date,
  state            text not null default 'active' check (state in ('active', 'paused', 'completed', 'abandoned')),
  is_completed     boolean default false,
  sub_goals        jsonb default '[]',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index on goals(user_id, state);
alter table goals enable row level security;
create policy "Users access own goals" on goals
  for all using (auth.uid() = user_id);

create table goal_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  goal_id      uuid not null references goals(id) on delete cascade,
  sub_goal_id  uuid,
  event_type   text not null check (event_type in ('add', 'subtract', 'state_change', 'target_change', 'complete')),
  value        numeric(14,2) not null default 0,
  date         date not null,
  note         text,
  new_state    text,
  old_target   numeric(14,2),
  new_target   numeric(14,2),
  created_at   timestamptz default now()
);

create index on goal_events(goal_id);
create index on goal_events(user_id, date);
alter table goal_events enable row level security;
create policy "Users access own goal events" on goal_events
  for all using (auth.uid() = user_id);

-- ========================================================
-- 7. BOOKS & QUOTES
-- ========================================================
create table books (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  author         text,
  cover_url      text,
  status         text not null default 'to-read' check (status in ('to-read', 'reading', 'finished', 'abandoned')),
  started_at     date,
  finished_at    date,
  current_page   int default 0,
  total_pages    int,
  cover_url      text,
  rating         int check (rating >= 1 and rating <= 5),
  tags           text[] default '{}',
  reflection     text,
  abandon_reason text,
  added_at       date default current_date,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index on books(user_id, status);
alter table books enable row level security;
create policy "Users access own books" on books
  for all using (auth.uid() = user_id);

create table quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  book_id    uuid not null references books(id) on delete cascade,
  text       text not null,
  page       int,
  date       date default current_date,
  created_at timestamptz default now()
);

create index on quotes(book_id);
create index on quotes(user_id);
alter table quotes enable row level security;
create policy "Users access own quotes" on quotes
  for all using (auth.uid() = user_id);

-- ========================================================
-- 8. AGENDA BLOCKS
-- ========================================================
create table agenda_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  description text not null,
  created_at  timestamptz default now(),
  constraint end_after_start check (end_time > start_time)
);

create index on agenda_blocks(user_id, date);
alter table agenda_blocks enable row level security;
create policy "Users access own agenda blocks" on agenda_blocks
  for all using (auth.uid() = user_id);

-- ========================================================
-- 9. INBOX ITEMS
-- ========================================================
create table inbox_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  text         text not null,
  type         text default 'thought' check (type in ('thought', 'idea', 'worry', 'todo', 'other')),
  processed    boolean default false,
  processed_at timestamptz,
  processed_to text check (processed_to in ('task', 'note', 'handled')),
  archived_at  timestamptz,
  captured_at  timestamptz default now()
);

create index on inbox_items(user_id, processed);
alter table inbox_items enable row level security;
create policy "Users access own inbox items" on inbox_items
  for all using (auth.uid() = user_id);

-- ========================================================
-- 10. NOTES
-- ========================================================
create table notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  title      text not null,
  content    text not null default '',
  template   text check (template in ('morning', 'night', null)),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on notes(user_id, date);
alter table notes enable row level security;
create policy "Users access own notes" on notes
  for all using (auth.uid() = user_id);

-- ========================================================
-- 11. PUSH SUBSCRIPTIONS
-- ========================================================
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  keys       jsonb not null,
  user_agent text,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

alter table push_subscriptions enable row level security;
create policy "Users manage own subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id);
