-- Migration for Module 5: Dashboard Widget System
alter table user_settings add column if not exists dashboard_widgets jsonb default '[]'::jsonb;
