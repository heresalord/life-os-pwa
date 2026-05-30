create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'credit', 'savings')),
  currency text not null,
  balance numeric(14,2) default 0,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table wallets enable row level security;
create policy "Users access own wallets" on wallets for all using (auth.uid() = user_id);

alter table transactions 
add column if not exists wallet_id uuid references wallets(id) on delete set null,
add column if not exists transfer_to_wallet_id uuid references wallets(id) on delete set null,
add column if not exists notes text;

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  period text not null check (period in ('daily', 'monthly', 'yearly')),
  limit_amount numeric(14,2) not null,
  currency text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table budgets enable row level security;
create policy "Users access own budgets" on budgets for all using (auth.uid() = user_id);

create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target numeric(14,2) not null,
  current numeric(14,2) default 0,
  currency text not null,
  deadline date,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table savings_goals enable row level security;
create policy "Users access own savings goals" on savings_goals for all using (auth.uid() = user_id);

create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null,
  type text not null check (type in ('i_owe', 'owe_me')),
  due_date date,
  paid boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table debts enable row level security;
create policy "Users access own debts" on debts for all using (auth.uid() = user_id);
