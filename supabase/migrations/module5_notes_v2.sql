-- Module 5 Notes v2 — add pinned, folder, word_count, is_template
-- Run this in the Supabase SQL editor.

alter table notes
  add column if not exists pinned      boolean not null default false,
  add column if not exists folder      text    not null default 'All',
  add column if not exists word_count  int     not null default 0,
  add column if not exists is_template boolean not null default false;

-- Expand the template check constraint to cover all 7 template types
alter table notes drop constraint if exists notes_template_check;
alter table notes
  add constraint notes_template_check
  check (template in ('morning', 'evening', 'weekly-review', 'gratitude', 'book-notes', 'meeting-notes', null));

-- Index for folder queries
create index if not exists notes_user_folder on notes(user_id, folder);

-- Index for pinned queries
create index if not exists notes_user_pinned on notes(user_id, pinned);
