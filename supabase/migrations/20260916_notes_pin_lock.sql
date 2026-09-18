-- Notes PIN lock — add pin_hash column
-- Run this in the Supabase SQL editor.
--
-- The client already assumes this column exists (src/types/database.ts,
-- useNoteMutations.ts setPinHash/clearPinHash, NotePinModal.tsx) — this
-- migration just brings the live schema in line with that code.
--
-- Security note: only a SHA-256 hash is ever stored or transmitted; the
-- plain PIN never leaves the device (see hashPin() in useNoteMutations.ts).

alter table notes
  add column if not exists pin_hash text;

comment on column notes.pin_hash is
  'SHA-256 hash of a 4-digit PIN. Null = note is not locked. Set/cleared via useNoteMutations setPinHash/clearPinHash.';
