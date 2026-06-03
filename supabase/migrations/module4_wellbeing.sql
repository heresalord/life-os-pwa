-- Migration for Module 4: Wellbeing (Daily Log)
alter table daily_records add column if not exists energy_am smallint check (energy_am between 1 and 5);
alter table daily_records add column if not exists energy_pm smallint check (energy_pm between 1 and 5);
alter table daily_records add column if not exists gratitude jsonb default '[]'::jsonb;
alter table daily_records add column if not exists win_of_day varchar(280);
alter table daily_records add column if not exists went_well text;
alter table daily_records add column if not exists do_differently text;
alter table daily_records add column if not exists tomorrow_focus text;
alter table daily_records add column if not exists morning_complete boolean not null default false;
alter table daily_records add column if not exists evening_complete boolean not null default false;
alter table daily_records add column if not exists day_score smallint check (day_score between 0 and 100) default 0;
alter table daily_records add column if not exists journal text;
