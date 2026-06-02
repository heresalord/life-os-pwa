-- Allow 'adjustment' as a valid transaction type.
-- Adjustments represent manual balance corrections and are treated separately
-- from income and expenses in all reporting (Overview, Transactions tab).

-- Drop the old check constraint and replace it to include 'adjustment'
alter table transactions
  drop constraint if exists transactions_type_check;

alter table transactions
  add constraint transactions_type_check
  check (type in ('expense', 'income', 'adjustment'));
