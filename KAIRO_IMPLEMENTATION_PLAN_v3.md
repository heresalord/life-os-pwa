# Kairo — Implementation Plan (v3)

**Stabilize → Social → Messaging**, then the rest.

Supersedes the ordering in `KAIRO_IMPLEMENTATION_PLAN.md` (v2). v2 stays in the repo for reference; where the two
disagree, this file wins.

Status legend: **S** ≈ under a day · **M** ≈ 1–3 days · **L** ≈ a week · **XL** ≈ 2 weeks or more.
Sizes are rough, for ordering only.

> **Private by default. Shared intentionally. Public selectively.**
> Friendship is a relationship. Sharing is a permission. They are never the same thing.

---

## 0. Why this plan exists (audit findings)

Everything below was read from the code, not guessed. Items marked **(unverified)** need a check against the live
Supabase project or a device, because the code alone cannot prove them.

### 0.1 Notes disappear when opened

`NoteEditorModal` is mounted all the time with `note = null`. `useDraft` creates its state **once**, on that first
render, with an empty initial value, and never re-seeds when the note changes. It then flushes `valueRef.current` to
`localStorage` on `visibilitychange → hidden` and `pagehide`, even if the user typed nothing.

Result: open note B, switch apps, and the hook writes `''` (or the last text typed in note A) into
`draft:note:B:body`. The next time B opens, the editor seeds from the draft because *a draft beats the database*. Close
the note and `handleSave` sees "content differs from the note" and saves the empty/wrong body, which then syncs to
every device. This is the "content is gone forever" bug. It was introduced by Phase A2 (drafts) of v2.

Desktop uses `DesktopNoteEditor`, which does not use `useDraft`, so desktop loss comes from sync (below).

### 0.2 Notes (and edits) don't sync reliably

| # | Problem | Where |
|---|---|---|
| 1 | `drainOfflineQueue` reads the queue, awaits the network, then **overwrites the whole queue** with only the failed items. Anything queued during the drain is lost. Drains can also overlap (startup, 60 s timer, `online` event). | `src/lib/sync.ts` |
| 2 | When online, a write is pushed directly even if **older writes for the same row are still queued**. The later drain then pushes the old version over the new one. | `syncToSupabase` |
| 3 | Items that fail 5 times are **silently dropped**. The row then exists only on that device. | `MAX_RETRIES` |
| 4 | Pulls `bulkPut` server rows over local rows with **no `updated_at` comparison**. | `useNotesQuery.ts` |
| 5 | Rows that exist only locally are kept forever and **never re-pushed**. | `localOnly` in `useNotesQuery.ts` |
| 6 | No tombstones: a note deleted on one device survives on another and can be written back. | `deleteNote` is a hard delete |
| 7 | `DesktopNoteEditor` seeds its text once per note id and saves on blur, so a stale desktop copy **overwrites newer content** from the phone. | `NotesPage.tsx` |
| 8 | No realtime, `refetchOnWindowFocus: false`, notes cache is 30 s. Changes from the other device only show up on a later fetch. | `queryClient.ts` |
| 9 | **(unverified)** Notes writes carry `pinned`, `folder`, `word_count`, `is_template`, `pin_hash`. Those columns come from migrations that must be run by hand. If any is missing on the live DB, every notes write fails, gets queued, and is dropped after 5 tries, while inbox (a tiny payload) keeps working. | `module5_notes_v2.sql`, `20260916_notes_pin_lock.sql` |

Inbox works because it is insert-only, small, and rarely edited, so most of the problems above never trigger for it.

### 0.3 Security findings that matter before adding social

- `notify(p_user_id, p_type, p_payload)` is `SECURITY DEFINER` with **no `auth.uid()` check**, and
  `src/lib/notifications.ts → sendNotification` calls it as a client RPC. **(unverified grants)** If `EXECUTE` is
  granted to `authenticated`, any signed-in user can push notifications to any user id.
- Share codes use `Math.random()` (6 chars) in `src/lib/share.ts`.
- After `20260707_rls_audit_and_schema_fixes.sql`, the `update_own` policy on `shared_items` lets the sender **or the
  recipient** update any column of the row, not just `status`.
- `user_profiles` is owner-only readable, so one user cannot look up another. Fine today, but social needs a
  controlled, minimal way to do it.

---

## 1. Order of work

```
Phase 0  Stop the bleeding ───── hotfixes, no redesign          (S–M)
Phase 1  Sync foundation ─────── durable outbox, tombstones,     (L)
                                 delta pull, realtime, history
Phase 2  Social ──────────────── usernames, friends, blocks      (L)   can start after Phase 0,
                                                                        in parallel with Phase 1
Phase 3  Messaging ───────────── chat + send note/inbox/task     (XL)  needs Phase 1 AND Phase 2
─────────────────────────────────────────────────────────────────
Later    Phase 4 capture-first · Phase 5 app feel · Phase 6 module cleanup
```

Why this order:

- Phase 0 protects your data today. Do it before anything else, including before reading further.
- Phase 1 replaces the sync layer. Chat on top of the current sync would lose messages the same way notes are lost.
- Phase 2 is almost entirely server-side and online-only (friend requests are not offline features), so it does not
  depend on Phase 1.
- Phase 3 reuses the Phase 1 outbox for offline sending and realtime for delivery, and the Phase 2 friendship model
  for permission.

### Relationship to the v2 plan

| v2 phase | Status under v3 |
|---|---|
| A1 offline launch, A3 reboot, A4 offline shell | Done / unchanged |
| A2 drafts | **Replaced** by Phase 0.3 (the original design is the bug) |
| B quick wins | Unchanged, ship anytime (B2, B4, B6 still open) |
| C notification core | Done; Phase 2/3 add new event types to it |
| D projects redesign | Deferred until after Phase 3 |
| E auth/profile/settings | Phase 2 adds username + privacy settings |
| F0 foundations, F1 friends, F2 sharing upgrade | **Absorbed into Phase 2** |
| F5 recommend/send | **Absorbed into Phase 3** (same mechanism: attachment snapshots) |
| F3 shared notes, F4 books, F6 activity, F7 public profiles, F8 groups | Deferred, order unchanged |

---

## Phase 0 — Stop the bleeding (S–M, about 1–2 days)

Goal: no more silent data loss, with the smallest possible code changes. No new architecture.

### 0.1 Check the live database and recover what can be recovered — **S**

Do this **before** changing sync code, and do not clear browser storage first.

1. In the Supabase SQL editor, confirm the notes table has every column the client writes:

   ```sql
   select column_name, data_type, is_nullable
   from information_schema.columns
   where table_schema = 'public' and table_name = 'notes'
   order by ordinal_position;
   -- must include: pinned, folder, word_count, is_template, pin_hash, template, updated_at
   ```

   If any are missing, run `module5_notes_v2.sql` and `20260916_notes_pin_lock.sql`. Also confirm
   `notes_template_check` allows every template key used in `TemplatePicker.tsx`.

2. Check the Supabase dashboard for backups (Database → Backups). If point-in-time recovery or daily backups are on,
   restore the `notes` table into a scratch schema and diff it against the live one. Lost notes may still be there.
3. On each device, **before** the fix ships, dump stale drafts. In the browser/WebView console:

   ```js
   Object.keys(localStorage).filter(k => k.startsWith('draft:')).forEach(k => console.log(k, localStorage[k]))
   ```

   Some lost text may only exist in these keys (or in the old `lifeos-offline-queue` key).
4. Dexie on each device may still hold notes the server lost. Run the export in 0.2 on every device first.

### 0.2 Export / backup button that covers everything — **S**

`ExportButton.tsx` and `exportUtils.ts` already exist. Confirm they cover notes, inbox, tasks, transactions, wallets,
goals, books and daily records, and extend them to produce **one JSON file of every Dexie table** plus the raw
`lifeos-offline-queue` contents. Put it in Settings → Data.

**Acceptance:** one tap produces a file that restores a fresh install (write the matching import too, even if it is
manual-only for now).

### 0.3 Fix `useDraft` — **M**

Replace the design, not the symptoms.

- A draft is stored as `{ value, baseUpdatedAt }` where `baseUpdatedAt` is the note's `updated_at` when editing began.
- The hook only writes when the user actually changed the field (`dirty` flag set by `onChange`). Backgrounding the
  app with no edits writes nothing.
- The hook is keyed: when the key changes, it resets its internal value and dirty flag. It never writes note A's text
  under note B's key.
- On open, a draft is offered **only if** `draft.baseUpdatedAt === note.updated_at` (the note has not changed since)
  and the draft is non-empty and differs from the note. Otherwise it is discarded. The database wins by default.
- `handleSave` (blur, Done, close) saves only when `dirty` is true. Never save on close just because the state
  differs from the prop.
- A save that turns non-empty content into empty requires an explicit user action in this session (the user really
  deleted the text), not an inferred one.
- Same rule for the title field.
- Audit every other `useDraft(` caller (journal wizard, free journal, quick capture, add-task) for the same pattern.

**Acceptance (all manual, on a phone):**
1. Open a note, background the app for 60 s, reopen: content intact.
2. Open note A, type, close; open note B, background the app: B unchanged, A unchanged.
3. Type in a note, force-kill the app, reopen: the typed text is restored.
4. Edit a note on desktop, then open it on the phone, which has an older draft: the desktop edit is shown, the stale
   draft is discarded.

### 0.4 Make `DesktopNoteEditor` stop overwriting newer content — **S**

- Re-seed from `note` when `note.updated_at` changes **and** the editor is not dirty.
- If the editor is dirty and the incoming `updated_at` is newer, show a banner: "This note changed on another
  device. Keep mine / Load theirs." Do not auto-save over it.

### 0.5 Sync hotfixes (small, before the Phase 1 rewrite) — **M**

All in `src/lib/sync.ts` and `src/lib/localFirst.ts`.

1. **Single-flight drain.** Keep a module-level `drainPromise`; a second call returns the existing one.
2. **Never overwrite the queue.** After the loop, re-read the queue, remove only the ids that succeeded, keep
   everything else (including items added mid-drain).
3. **Preserve order.** In `syncToSupabase`, if the queue already holds an item for the same `table + payload.id`,
   append to the queue instead of pushing directly.
4. **Never drop.** After `MAX_RETRIES`, mark the item `blocked` with the last error message and keep it. Add
   exponential backoff (e.g. 5 s, 30 s, 2 min, 10 min).
5. **Make failures visible.** Show pending count, blocked count and the last error in `SyncStatusDot` and in a new
   Settings → Sync diagnostics page with "Retry now" and "Export queue".
6. **Don't regress on pull (notes only for now).** In `useNotesQuery`, skip a server row when the local row has a
   newer `updated_at`. Keep the existing queue-aware reconcile.
7. **Refresh when you come back.** Enable `refetchOnWindowFocus` for notes and inbox, and invalidate on Capacitor
   `appStateChange → active`.

**Acceptance:** with two devices, create/edit/delete notes in every online/offline combination. Nothing disappears,
nothing reverts, and every failure shows up in diagnostics.

### 0.6 Security hotfixes — **S**

- Find every caller of `sendNotification` / `rpc('notify')`. Move those events to database triggers or an Edge
  Function, then:

  ```sql
  revoke execute on function notify(uuid, text, jsonb) from public, anon, authenticated;
  ```

  If a caller cannot be moved yet, add `if auth.uid() is not null and auth.uid() <> p_user_id then raise exception ...`
  as a stopgap.
- Generate share codes server-side (`gen_random_bytes`) instead of `Math.random()`.
- Restrict `shared_items` updates so a recipient can change only `status` and `shared_with_id`, via an RPC
  `redeem_share_code(code)` rather than a raw table update.

---

## Phase 1 — Sync foundation (L, about 1–1.5 weeks)

Goal: a sync layer where local writes are durable, ordering is preserved, conflicts are handled instead of ignored,
deletes propagate, and devices update live.

### 1.1 Data contract — **M**

Every synced table gets:

| Column | Rule |
|---|---|
| `id uuid` | Generated on the client. Primary key. Makes every write idempotent. |
| `user_id uuid` | Owner. RLS keyed on it. |
| `updated_at timestamptz` | **Set by the server** in a `BEFORE INSERT OR UPDATE` trigger. The client cannot spoof it. |
| `deleted_at timestamptz null` | Tombstone. Deletes become updates. |

Migration file: `YYYYMMDD_sync_v2_columns.sql`. Backfill `updated_at` where null. Add an index on
`(user_id, updated_at)` per table so delta pulls are cheap. Do **not** rename the Dexie database or any table/column
(data-loss rule from v2 B6).

### 1.2 Durable outbox in Dexie — **M**

Replace the `lifeos-offline-queue` localStorage queue and `reconcilePendingSync`.

```ts
// Dexie v17
outbox:     'seq++, row_key, table, status, created_at'   // seq = global order
sync_state: 'table'                                        // { table, cursor, last_pull_at }
```

`outbox` row: `{ seq, id, table, op, row_id, patch, base_updated_at, attempts, last_error, status, created_at }`
with `status` in `pending | inflight | failed | blocked`.

Rules:
- **One Dexie transaction** writes the row and its outbox entry together. No state where the local write happened
  and the queue entry did not.
- A single worker drains in `seq` order. Consecutive updates to the same row are coalesced into one patch.
- Retries use backoff. Permanent errors (schema mismatch, RLS denial) become `blocked` and stay visible. Nothing is
  ever deleted from the outbox except after a confirmed success.
- Drains start on app start, `online`, foreground, window focus, and a 60 s timer; always single-flight.
- One-time migration: read `lifeos-offline-queue`, copy its items into `outbox`, then remove the key.

### 1.3 Push and conflict handling — **M**

- Updates send **only changed fields** plus `base_updated_at`.
- For **notes** (the only table where two devices edit the same long text), use a Postgres function:

  ```sql
  -- sketch
  create function upsert_note(p_row jsonb, p_base timestamptz) returns jsonb ...
  -- if the server row's updated_at > p_base AND content differs:
  --   insert the client's version as a new note "<title> (conflict copy)" and return {conflict: true}
  -- else apply and return the row.
  ```

  The user never silently loses text: the losing version is kept as a conflict copy and flagged in the UI.
- All other tables use last-write-wins per field, resolved by the server `updated_at`.

### 1.4 Delta pull — **M**

Retire `bgSync` + `bulkPut`.

- Per table: `select * from t where user_id = :me and updated_at > :cursor order by updated_at, id limit 500`,
  repeated until empty. Store the cursor in `sync_state`.
- Merge rule per row: if the local row has pending outbox entries, **skip** (the outbox will win or conflict later);
  otherwise apply the server row if `server.updated_at >= local.updated_at`.
- `deleted_at` rows delete locally (tombstones are purged client-side after 30 days).
- First sync on a new device is the same loop starting from the epoch, paginated.

### 1.5 Realtime — **S**

- Add the synced tables to the `supabase_realtime` publication **(verify it is not already on)**.
- One channel per table filtered by `user_id=eq.<uid>`. On an event, apply the same merge rule and invalidate the
  matching React Query keys.
- If the channel drops, the focus/foreground/60 s pull is the safety net, so realtime is an optimization, not a
  dependency.

### 1.6 Soft deletes, Trash and version history — **M**

- Replace hard deletes with `deleted_at`. Queries filter `deleted_at is null`.
- **Trash** screen (More → Trash): list, restore, delete forever. Purge server-side after 30 days using the cron
  mechanism already in `cron_jobs.sql`.
- **Note history:** table `note_versions (id, note_id, user_id, title, content, created_at)` filled by a server
  trigger whenever `content` changes (throttled to one version per 5 minutes per note, keep the last 30). A "Version
  history" action in the note menu restores any version as a new edit. Because it is server-side, it protects against
  any client bug, including future ones.

### 1.7 Rollout order — **M**

Each table moves to the new layer behind a per-table flag so it can be rolled back:

1. `notes` (+ history, Trash, conflict copies)
2. `inbox_items`
3. `tasks`, `recurring_tasks`
4. `transactions`, `wallets`, `budgets`, `savings_goals`, `debts`
5. everything else (`goals`, `goal_events`, `habit_logs`, `milestones`, `books`, `quotes`, `agenda_blocks`,
   `daily_records`, `projects`, `user_settings`)

Delete `bgSync`, `reconcilePendingSync`, and the old queue code once the last table is moved.

### 1.8 Tests — **M**

- Add `vitest` (not currently a dependency). Unit-test the merge function, outbox coalescing, backoff, and the
  conflict RPC (SQL test against a local Supabase).
- Manual matrix, two devices (phone + desktop): create / edit / delete × online / offline / flaky, including "edit the
  same note on both while one is offline".
- A "chaos" toggle in dev builds that fails 30% of pushes, to prove retries and ordering hold.

**Phase 1 acceptance:**
1. Edit the same note on phone (offline) and desktop (online), reconnect the phone: both versions survive (one as a
   conflict copy).
2. Delete a note on desktop: it disappears from the phone within seconds (realtime) or on next focus, and appears in
   Trash.
3. Kill the app mid-sync: on restart, every pending write is still in the outbox and completes.
4. The diagnostics page shows an accurate pending/blocked count at all times.
5. A fresh install on a new device reaches the same state as the others without a manual step.

---

## Phase 2 — Social: add other users (L, about 1 week)

Goal: users can find each other, send and accept friend requests, and manage who they are connected to. **Friendship
grants no access to anything.** It only makes someone eligible to be messaged and shared with.

Social data is **server-authoritative and online-only** (you cannot "send a friend request" offline). It is cached
read-only in Dexie so the friends list still renders offline, but all mutations require a connection and show a clear
message when offline. This keeps Phase 2 independent of Phase 1.

### 2.1 Usernames and public profile — **M**

Decision (already locked in v2): usernames are **optional at signup, required before the first social action**.

```sql
-- sketch
alter table user_profiles
  add column username text,
  add column username_changed_at timestamptz;
create unique index user_profiles_username_ci on user_profiles (lower(username));
alter table user_profiles add constraint username_format
  check (username ~ '^[a-z0-9_]{3,20}$');
```

- Suggest a default from the email prefix, editable.
- Reserve `admin`, `support`, `kairo`, `help`, `system`, and similar names in a `reserved_usernames` table.
- Changeable at most once per 30 days.
- **Never expose `user_profiles` directly.** Other users see only `id, username, display_name, avatar_url`, and only
  through the RPCs below.

### 2.2 Tables and functions — **M**

```sql
-- sketch
create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users on delete cascade,
  to_user   uuid not null references auth.users on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);
create unique index friend_requests_one_pending
  on friend_requests (least(from_user,to_user), greatest(from_user,to_user))
  where status = 'pending';

create table friendships (
  user_a uuid not null references auth.users on delete cascade,
  user_b uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)                 -- each pair stored once
);

create table blocks (
  blocker uuid not null references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker, blocked)
);
```

RLS: users can `select` rows where they are a party. **No client `insert`/`update`/`delete` on `friendships`.** All
state changes go through `SECURITY DEFINER` functions that check `auth.uid()`:

| Function | Behavior |
|---|---|
| `find_user_by_username(p_username)` | Exact match only. Returns `id, username, display_name, avatar_url` or nothing. No prefix search, no browse, to avoid user enumeration. Excludes users who blocked the caller. |
| `send_friend_request(p_to)` | Requires a username on both sides; rejects self, existing friends, existing pending request (either direction), and blocks. If the other user already requested you, it accepts instead. Rate-limited (for example 20 per day). |
| `respond_friend_request(p_id, p_accept)` | Only the recipient. Creates the `friendships` row on accept. |
| `cancel_friend_request(p_id)` | Only the sender. |
| `remove_friend(p_user)` | Deletes the friendship. Existing message history is kept (see Phase 3). |
| `block_user(p_user)` / `unblock_user(p_user)` | Block also removes the friendship and cancels pending requests. |
| `get_profiles(p_ids uuid[])` | Returns the minimal profile only for the caller's friends and the people in the caller's pending requests. |

Notifications (`friend.request_received`, `friend.request_accepted` already exist in `EVENT_CATALOG`) are emitted by
**triggers on `friend_requests`** that call `notify()`. The client never calls `notify` (0.6).

### 2.3 Client — **M**

- New files: `src/api/friends.ts`, `src/hooks/useFriendsQuery.ts`, `src/hooks/useFriendMutations.ts`, and
  `src/pages/friends/FriendsPage.tsx`.
- Entry point: Profile → Friends (and More → Friends), with a badge for incoming requests.
- Tabs: **Friends** · **Requests** (incoming/outgoing) · **Add**.
- **Add:** search by exact username; also an invite link/QR of the form `https://<app-domain>/add/<username>` that opens
  the app on the profile with an "Add friend" button (deep link through Capacitor `App` URL handling).
- First social action without a username → "Pick a username" sheet, then continue the action.
- Friend row actions: Remove, Block. Blocked list in Settings → Privacy with Unblock.
- All text through `i18n` (`en.json` and `fr.json`).
- Offline: render the cached list, disable actions with a one-line explanation.

### 2.4 Privacy settings — **S**

Settings → Privacy: who can send friend requests (Everyone with my username / Nobody), show my avatar to non-friends
(on/off). Default: requests allowed, avatar visible only to friends.

### 2.5 RLS test matrix — **M**

Write `supabase/tests/social_rls.sql` and run it before shipping. For each role (owner, friend, pending requester,
stranger, blocked user) verify read/write/delete on `user_profiles`, `friend_requests`, `friendships`, `blocks`,
`shared_items`. This matrix is reused in Phase 3.

**Phase 2 acceptance:**
1. Two accounts can find each other by exact username, request, accept, and see each other in the Friends tab.
2. A stranger cannot read another user's profile, friendships, or requests, by any query.
3. A blocked user cannot find, request, or see the blocker, and gets no signal that they are blocked.
4. Removing a friend leaves no access to anything.
5. Notifications fire once per event, through triggers only. `rpc('notify')` from a client is rejected.

---

## Phase 3 — Messaging module (XL, about 2 weeks)

Goal: friends can chat in 1:1 conversations and send each other notes, inbox items, tasks and similar items, with
offline sending, live delivery, push notifications, and the same safety rules as the rest of the app.

Requires Phase 1 (outbox + realtime) and Phase 2 (friendships + blocks).

### 3.1 Principles

- **Attachments are snapshots, not access.** Sending a note copies its content into the message. The recipient gets a
  card with an action to **save it into their own notes** (or inbox/tasks). They never get read access to the sender's
  record, and later edits by the sender do not change what was sent. (Same rule as v2 F5.)
- **PIN-locked notes cannot be sent**, and `pin_hash` is never part of any snapshot.
- **Journal-folder notes are excluded** from the send picker by default (v2 rule: journal stays private).
- **Finance data is never an attachment type** in v1.
- Messages are server-ordered; the client generates the UUID, so a retried send can never create a duplicate.
- v1 is **not end-to-end encrypted** (TLS + RLS). Say so in the UI. E2E is listed under open decisions because it
  conflicts with server-side push previews and search.

### 3.2 Data model — **M**

```sql
-- sketch
create table conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group')),  -- group reserved, not built in v1
  direct_key text unique,               -- least(a,b) || ':' || greatest(a,b) for direct chats
  created_at timestamptz default now(),
  last_message_at timestamptz
);

create table conversation_members (
  conversation_id uuid references conversations on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member',
  last_read_at timestamptz,
  muted boolean not null default false,
  hidden boolean not null default false,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

create table messages (
  id uuid primary key,                                  -- client-generated, idempotent
  conversation_id uuid not null references conversations on delete cascade,
  sender_id uuid references auth.users on delete set null,
  kind text not null check (kind in ('text','attachment','system')),
  body text,                                            -- <= 4000 chars
  attachment jsonb,                                     -- { type, schema_version, snapshot } <= 100 KB
  reply_to uuid references messages,
  created_at timestamptz not null default now(),        -- server time = canonical order
  edited_at timestamptz,
  deleted_at timestamptz                                -- "unsent"
);
create index messages_conv_created on messages (conversation_id, created_at desc, id);
```

Rules (enforced in RLS and a `BEFORE INSERT` trigger):
- `select`: only members of the conversation.
- `insert`: `sender_id = auth.uid()`, caller is a member, **the other member is still a friend and has not blocked
  the caller**, size limits respected, rate limit (for example 30 messages per minute per user).
- No client `update`/`delete`. "Unsend" and "edit" go through an RPC that allows only the sender, on their own
  messages, within a time window (for example 15 minutes for edits; unsend any time → sets `deleted_at` and clears
  `body`/`attachment`).
- `get_or_create_direct_conversation(p_friend uuid)` is the only way to create a conversation; it checks friendship
  and blocks.
- If a friendship ends or a block happens, history stays readable but **sending is disabled**.
- Account deletion: `sender_id` becomes null and the UI shows "Deleted user".

### 3.3 Attachment types (v1) — **M**

| Type | Snapshot contains | Recipient action |
|---|---|---|
| `note` | `title`, `content` (markdown), `tags`, `word_count`. **Never** `pin_hash`, `folder`, ids, or `date`. | **Save to my notes** (creates a new note in "All") |
| `inbox_item` | `text`, `type` | **Add to my inbox** |
| `task` | `title`, `priority`, optional `date` | **Add to my tasks** (date picker defaults to today) |
| `book` (v1.1) | title, author, cover url | **Add to want-to-read** (replaces v2 F5 "recommend") |
| `quote` (v1.1) | text, author, book title | **Save to my quotes** |
| image (v2) | storage path | later, needs Supabase Storage + size limits |

Each snapshot carries `schema_version` so old messages still render after the format evolves. Unknown types render as
"Unsupported attachment — update the app".

Received content is untrusted:
- Render markdown with `react-markdown` **without** raw HTML; open links with `rel="noopener noreferrer"`.
- Do **not** auto-load remote images from received markdown (tracking); show them as links.
- Cap snapshot size at 100 KB.

### 3.4 Local-first and sync — **M**

- New Dexie tables (version 17 or 18): `conversations`, `conversation_members`, `messages` (cache).
- Sending writes the message row (`status: sending`) and the outbox entry in one transaction, then renders it
  immediately. Statuses shown in the UI: sending → sent → failed (tap to retry). "Delivered/read" comes from the
  recipient's `last_read_at`.
- Pull: RPC `messages_since(p_cursor timestamptz, p_cursor_id uuid, p_limit int)` returns messages across all the
  caller's conversations (RLS applies). Older history in a conversation is fetched on scroll.
- Merge by `id`. Display order is `(created_at, id)`; locally pending messages sit at the bottom ordered by local
  send time until the server timestamp arrives.
- Cache policy: keep the latest 500 messages per conversation locally; older ones are fetched on demand.

### 3.5 Realtime delivery — **M**

Preferred approach: a database trigger on `messages` that broadcasts to a **private per-user channel**
(`user:<recipient_id>:messages`) using Supabase Realtime broadcast with RLS on `realtime.messages`, so one
subscription per user receives everything, regardless of how many conversations exist. **Verify the exact API against
the Supabase version in use** before building; the fallback is `postgres_changes` on `messages` filtered by
`conversation_id` for the open conversation plus a 15 s poll of `messages_since` for the list.

On receipt: merge into Dexie, update unread counts, and show an in-app toast if the conversation is not open.

### 3.6 Push notifications — **M**

- Add `message.received` to `EVENT_CATALOG` and to `get_notification_defaults()` (in-app: handled by the unread badge,
  not a `notifications` row per message; push: on; email: off).
- DB trigger → `pg_net` → the existing `send-push` Edge Function, skipping muted conversations and recipients who
  turned the event off. Use a **collapse key per conversation** so a burst becomes one notification.
- Body: "Alex: <text>" or "Alex sent you a note". Setting: **Hide message previews** (shows "New message").
- Android channel for messages, separate from reminders.

### 3.7 UI — **L**

Screens and files (under `src/pages/messages/` and `src/components/messages/`):

1. **Conversation list.** Avatar, name, last-message preview, time, unread count; swipe to mute/hide. Empty state
   points to "Add a friend".
2. **Conversation.** Message bubbles, day separators, sending/failed state, reply-to, long-press menu (Copy, Reply,
   Unsend, Delete for me). Composer with a **+** menu: Note, Inbox item, Task (and Book/Quote later) and a send
   button. Scroll anchoring so new messages never jump the view while you read history.
3. **Attachment cards** with the recipient actions from 3.3, and a confirmation toast after saving ("Added to your
   notes").
4. **"Send to a friend"** entry points: in the note action sheet, on inbox item cards, and on task items. Each opens a
   friend picker, then sends the attachment as a message (optionally with a text).
5. **Navigation.** Messages gets a badge. Initially under More and the header; promote to the bottom nav in Phase 5.
6. **Settings → Messages.** Read receipts (on/off), hide previews, blocked users.
7. All strings in `en.json` and `fr.json`.

### 3.8 Safety, abuse and limits — **M**

- `reports` table (reporter, message id, reason, created_at) and a "Report" action; reports are only readable by you
  (service role) for now.
- Block from inside a conversation.
- Rate limits and size limits enforced server-side (3.2), not just in the client.
- Link handling per 3.3.
- Delete conversation = hide for me (`hidden = true`); it does not delete the other person's copy.

### 3.9 Tests — **M**

- Extend the RLS matrix (Phase 2.5) to `conversations`, `conversation_members`, `messages`: a stranger, a removed
  friend, and a blocked user can neither read nor send.
- Idempotency: replay the same send 5 times, expect exactly one row.
- Two-device, two-account run: send online, send offline then reconnect, unsend, send each attachment type, save each
  attachment to the recipient's own data, block mid-conversation.
- Confirm a PIN-locked note and a Journal note cannot be attached, and that no snapshot ever contains `pin_hash`.

**Phase 3 acceptance:**
1. Two users on different devices chat with messages arriving within about a second while both are online.
2. A message composed offline sends once on reconnect, in order, with no duplicates.
3. A note, an inbox item and a task sent to a friend can each be saved by the recipient into their own account in one
   tap, and the sender's original is untouched.
4. After a block or unfriend, neither side can send; history is still readable.
5. A push arrives for a message when the app is closed, collapsed per conversation, and respects mute and the "hide
   previews" setting.

---

## Later (order unchanged from the earlier discussion)

| Phase | Content | Notes |
|---|---|---|
| **4 Capture-first** | One capture bar that creates tasks, notes, inbox items and transactions ("taxi 1500"); Android app shortcuts, share target, tappable widgets; a three-field transaction form with the rest under "More". | "Send to a friend" becomes one more capture target. |
| **5 Feels like an app** | 4–5 bottom-nav destinations (Messages gets one), consistent transitions, empty/loading/error states, pull-to-refresh. | |
| **6 Module cleanup** | Decide the future of Inbox (becomes the capture destination or merges into Tasks), hide unused modules. | |
| v2 leftovers | B2, B4, B6, D projects redesign, F3 shared notes, F4 books social, F6 activity, F7 public profiles, F8 groups (the conversation model already reserves `kind = 'group'`). | |

---

## Cross-cutting checklist (every phase)

- One migration file per schema change, named `YYYYMMDD_description.sql`, with a note that it must be run in the
  Supabase SQL editor. **Run it on the live project and record that it ran** (this is how the notes columns got out of
  sync in the first place).
- Regenerate types after each migration: `npm run types:supabase`.
- Dexie version bump for every new local table (the current schema is version 16; the next is 17). Never rename the
  existing database or tables.
- RLS policy **and** a test for every new table (reuse the matrix from Phase 2.5).
- Empty, loading, error and offline states for every new screen.
- Strings added to both `en.json` and `fr.json`.
- `npm run verify` (tsc, eslint, build) clean before each commit; test on a real Android build, not just the browser.
- No secrets in the repo: `.env`, `.env.local` and `android/lifeos.keystore.b64` exist in the project folder. Confirm
  they are ignored by git and rotate anything that was ever committed.

---

## Decisions to confirm (defaults assumed if you say nothing)

1. **Find people by exact username only** (plus invite link/QR). Email lookup is off by default, to prevent
   enumeration.
2. **1:1 chats only** in v1; groups come later.
3. **Not end-to-end encrypted** in v1 (TLS + RLS). E2E would block server-side push previews, search and
   server-side moderation, so it would be a separate project.
4. **Attachment types in v1:** note, inbox item, task. Book and quote in v1.1; images later.
5. **Removing a friend keeps chat history** but disables sending.
6. **Conflict policy for notes:** keep both (the losing edit becomes a "conflict copy"), never auto-merge text.
7. **Supabase backups:** confirm which plan the project is on and whether point-in-time recovery is available (affects
   Phase 0.1).

---

## Suggested order inside each week

- **Days 1–2:** Phase 0 in full (0.1 → 0.6).
- **Week 1–2:** Phase 1 (1.1 → 1.4 first, then 1.5–1.8). In parallel, if you want: Phase 2.1–2.2 (database only).
- **Week 2–3:** finish Phase 2 (client + tests) while Phase 1 rolls out table by table.
- **Week 3–5:** Phase 3 (3.2 → 3.5 first so chat works end to end with text, then attachments, push and polish).
- **Then:** Phase 4 and onwards.
