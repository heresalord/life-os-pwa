# Kairo — Implementation Plan (v2)

Supersedes the earlier "Kairo Social" phase list. Same product principle, reordered
around what the code actually looks like today.

> **Private by default. Shared intentionally. Public selectively.**
> Friendship is a relationship. Sharing is a permission. They are never the same thing.

Status legend: **S** ≈ under a day · **M** ≈ 1–3 days · **L** ≈ a week or more.
Sizes are rough, for ordering only.

Not covered here: the Login / Profile / Settings visual redesign. It is already
done (outside this plan). Phase E only tracks the social hooks it must support.

Decisions locked in: rename covers the whole app (B6) · Hostinger SMTP (C3,
with the caveat there) · usernames optional at signup, required at first social
action (F1) · app has no installs yet, so the Capacitor `appId` may change (B6) ·
notification emails: test Hostinger SMTP on port 465 first, HTTPS email API as
the fallback (C0) · the domain's DNS is managed at Hostinger (C0).

---

## Order of work

```
A  Reliability ─────────► blocks trust in everything else
B  Quick wins ──────────► independent, ship anytime
C  Notification core ───► blocks D and F
D  Projects redesign ───► first consumer of C
E  Auth / Profile / Settings (redesign done; social hooks only)
F  Social (friends → sharing → notes → books → recommend → activity → public)
```

A and B can run in parallel. C should finish before D and F start.

---

## Phase A — Reliability (do first)

Local-first is the product's core promise. Today it breaks in two visible ways.

### A1. Offline launch sends you to onboarding or sign-in — **M**

**Root cause (confirmed in code):**

- `AuthContext.fetchProfile` never caches. Offline, it throws or errors, breaks
  out of the loop, and returns `null`.
- `AuthGuard` computes `needsOnboarding = !profile || !profile.onboarded`.
  A *failed fetch* and a *missing profile* both look like `null`, so an offline
  user is redirected to `/onboarding`.
- If there is no session at all, the 8-second safety timer clears `loading`
  and `AuthGuard` redirects to `/signin`.

**Fix:**

1. Cache the last good profile in `localStorage` (`kairo:profile:<userId>`) on
   every successful fetch. Also cache `kairo:lastUserId`.
2. Replace the boolean with an explicit status:
   `profileStatus: 'loading' | 'ready' | 'missing' | 'unknown'`.
   - `ready` — server returned a row.
   - `missing` — server answered and there is no row (only case that goes to onboarding).
   - `unknown` — network failure; use the cached profile if one exists.
3. `AuthGuard` only redirects to onboarding on `missing`, or on `ready` with
   `onboarded === false`. On `unknown` with a cached profile, render the app.
4. Verify how supabase-js behaves when the stored access token is expired and
   the refresh call fails with a network error. It should keep the stored
   session. If it does not, fall back to `lastUserId` and open the local
   Dexie DB read-only until connectivity returns.
5. Never call `signOut` or clear state on a network error. Only an explicit
   `SIGNED_OUT` event or an auth-rejected refresh does that.

**Acceptance:** airplane mode → force-quit → reopen → lands on Today with data.
Sign-in only appears if the user truly has no session.

### A2. Drafts vanish when you leave the app — **M**

**Root cause:** in-progress text lives only in React state (wizard fields, the
free-journal box, note editor, capture box). If the WebView is backgrounded and
reclaimed, or the page reloads, it is gone. `wizardStep` also resets to 1.

**Fix:** one reusable `useDraft(key, value, { enabled })` hook.

- Write to `localStorage` debounced ~300 ms.
- Flush immediately on `visibilitychange → hidden`, `pagehide`, and Capacitor
  `appStateChange → inactive`.
- Restore on mount; clear on successful save or explicit discard.
- Key by user + date + surface, for example `draft:<uid>:2026-09-28:morning-journal`.

**Apply to:** wizard journal fields, intention, gratitude, reflection fields,
`wizardStep`; free-journal entry box; note title/body; inbox quick-capture;
add-task modal.

**Acceptance:** type in the journal, background the app for 60 s (and force-kill
it), reopen → text and wizard step are restored.

### A3. Diagnose the "reboot" itself — **Done**

Diagnosed and resolved:
- `vite.config.ts` was using `registerType: 'autoUpdate'`, which automatically enabled Workbox `skipWaiting: true` and `clientsClaim: true`. Whenever a new build was deployed or the PWA checked for updates on foregrounding/reopening, `virtual:pwa-register` forced a `window.location.reload()`, killing active typing sessions mid-action.
- Furthermore, native Capacitor WebView was registering the PWA service worker needlessly.
- **Fix applied:** Changed `registerType` to `'prompt'` in `vite.config.ts` with `skipWaiting: false` and `clientsClaim: false` for update-on-next-launch behavior (open sessions are never reloaded). Gated SW registration in `src/main.tsx` to web/PWA only (`!Capacitor.isNativePlatform()`).

### A4. Offline shell — **Done**

Confirmed and completed:
- **Precache & Offline Shell:** Workbox generates `NavigationRoute` bound to precached `index.html` and precaches all 111 assets (`index.html`, all js chunks, css, icons, manifests). The app shell opens completely offline on web/PWA.
- **Offline writes & queue:** All mutations write to local Dexie IndexedDB first for immediate UI updates, and append to `lifeos-offline-queue` in localStorage if offline or network fails. When reconnecting (`window online`), `drainOfflineQueue()` pushes queued operations to Supabase in chronological order.
- **Offline indicator:** Extended [`SyncStatusDot.tsx`](file:///Users/durockkoumassi/Life%20OS/src/components/SyncStatusDot.tsx) with an `"Offline"` label and `showLabel` support. The top bars ([`AppShell.tsx`](file:///Users/durockkoumassi/Life%20OS/src/components/layout/AppShell.tsx), [`DesktopTopbar.tsx`](file:///Users/durockkoumassi/Life%20OS/src/components/layout/DesktopTopbar.tsx)) now show `[ WifiOff ] Offline` when disconnected, and [`DesktopSidebar.tsx`](file:///Users/durockkoumassi/Life%20OS/src/components/layout/DesktopSidebar.tsx) dynamically displays `Synced`, `Syncing…`, or `Offline`.

---

## Phase B — Quick wins

### B1. Finance timeframe selector — **Done**
Controls stacked to prevent horizontal scrolling:
- Top: full-width 5-column segmented control `[ Day | Week | Month | Year | Custom ]`
- Bottom: centered navigator `‹  March 2026  ›` with comfortable tap targets (replaces navigator with the from/to date pickers in Custom mode).

### B2. Last-edit time on note and inbox cards — **S**
Today `NoteCard` renders `toLocaleTimeString()` for every note, so a note from
last month shows just `02:14 PM` with no day. (An earlier draft of this plan
had this backwards.) One helper, `formatEditedAt(iso)`:

- today → `2:14 PM`
- yesterday → `Yesterday`
- within 7 days → weekday (`Tuesday`)
- older → `Sep 3` (add the year if not the current year)

Use it in `NoteCard` and inbox item cards.

### B3. Projects: one "+" that offers Create or Join — **Done**
Removed duplicate mobile FAB. Desktop header button and global contextual FAB now open a unified action sheet (`ProjectActionSheet`):
**Create project** (opens `CreateProjectModal`) · **Join with code** (opens `JoinProjectModal` with invite code redemption). Reusable for Phase D.

### B4. Notes: drop the Write/Preview toggle — **M**
Apple Notes has no preview mode, so the toggle reads as a developer tool.

**Constraint:** notes are stored as markdown, and other features depend on that
(journal `## Morning` / `## Evening` parsing, `[[note links]]`, `#tags`,
checklists). Switching storage to HTML would break them.

**Plan (low risk):** keep markdown as storage, remove the toggle.

- A note opens *rendered* (checklists tappable, links live).
- Tapping the body enters edit mode with the formatting toolbar; leaving edit
  mode re-renders.
- A later, separate spike can evaluate a true live editor (TipTap with markdown
  serialization) if this still feels off.

### B5. Duplicate pin icon on pinned notes — **Done**
A pinned note showed two pins: one beside the title and the toggle button on
the right. Removed the title one; the toggle stays because it shows the state
and unpins. Same file, worth doing next: a locked note shows three lock icons
(title, body hint, footer badge). Keep one.

### B6. Rename to Kairo across the app — **M**
Decision: the rename covers the whole app. Do it as branding only.

**Change:** UI strings, `index.html` title, PWA manifest name, README,
`package.json` `name`, Capacitor `appName`, Android `strings.xml`, app icons
and splash, email templates.

**Do NOT change (data-loss risk):**
- Dexie database names (`LifeOSDB_${userId}`) and any localStorage/IndexedDB
  key prefixes. Renaming them makes existing users' local data look empty.
  If new names are ever wanted, that needs a migration that copies data first.
- Supabase table and column names.

**Change once, now (you confirmed there are no installs or store listings):**
the Capacitor `appId` / Android `applicationId`. Do it before push notifications
are set up, because Firebase (FCM) config is tied to the package id, and before
any store listing exists. It touches `capacitor.config.ts`, the Android
`applicationId` and package folders, and any OAuth or deep-link redirect URLs.
After the first real install, treat it as frozen.

Grep for `Life OS`, `LifeOS`, and `life-os`, then sort every hit into
branding (change) or identifier (leave).

---

## Phase C — Notification core

Everything social depends on this, and so does the "someone joined your
project" notification. Build it once.

**Audit first.** `module7_notifications.sql`, `NotificationContext`,
`NotificationCenter`, and `pushNotifications.ts` already exist. Extend them
rather than replacing them.

### C0. Email spike (before building C3) — **S**
Decision: try Hostinger SMTP on port 465 first. This step exists so the answer
comes from a test, not from the docs (which say it should fail).

1. In Hostinger, create a sending mailbox such as `no-reply@yourdomain`.
   Confirm the SMTP host and port in that mailbox's settings.
2. Write a throwaway Edge Function that sends one email through an SMTP client
   to Hostinger on 465 with TLS. Keep the credentials in Supabase secrets only,
   never in the repo or the client bundle.
3. **Test on the deployed function**, not only locally. Local runs may not have
   the same outbound restrictions, so a local pass proves nothing.
4. Send to a Gmail and an Outlook address. Check that it reaches the inbox, not
   spam, and that the message headers show SPF, DKIM and DMARC as `pass`.
5. **Pass:** connects, delivers reliably across a few sends, headers pass →
   use SMTP for notification emails.
   **Fail** (connection refused, timeouts, or flaky) → switch to an HTTPS email
   API from your own domain. Either way, delete the spike function afterwards
   and record the result here.

**DNS (managed at Hostinger):** edit the records in the domain's DNS zone.
- A domain can have only **one** SPF TXT record. If a second sender is added
  later (for example an email API), merge it into the existing record instead
  of creating another.
- Add the DKIM record for whichever service actually sends the mail.
- Start DMARC in monitor mode (`p=none`), read the reports for a while, then
  tighten it.

Auth emails (sign-up confirmation, password reset) are separate: they use the
SMTP settings in the Supabase dashboard and don't depend on this spike.

### C1. Event → notification pipeline — **Done**

```
domain event ─► notify(user, type, payload)
                  ├─ in-app row   (always, unless muted)
                  ├─ email        (per preference)
                  └─ push         (per preference)
```

Tables (reconciled in `supabase/migrations/20261005_phase_c_notification_pipeline.sql`):

- `notifications` — `id, user_id, title, body, type, payload jsonb, read, read_at, action_url, created_at`
- `notification_preferences` — `user_id, event_type, in_app, email, push, created_at, updated_at`
- `devices` — `id, user_id, platform ('ios'|'android'|'web'|'pwa'), push_token, last_seen_at, created_at`

- Database function `notify(user_id, type, payload)` dispatches domain events with preference checks and auto-creates in-app notifications.
- Triggers on `shared_items`: emits `project.member_joined` on invite acceptance, and `share.invited` on new invite.
- Triggers on `transactions`: emits `finance.budget_warning` with budget percentage and spending details.
- Client helpers in `src/lib/notifications.ts` for preference retrieval/updates, device registration, and event dispatch.

### C2. Event catalog (v1) — **Done**

Catalog constants and defaults implemented in `src/lib/notifications.ts` (`EVENT_CATALOG`):

| Event | In-app | Email | Push |
|---|:-:|:-:|:-:|
| `project.member_joined` | ✓ | opt | ✓ |
| `share.invited` | ✓ | ✓ | ✓ |
| `friend.request_received` | ✓ | ✓ | ✓ |
| `friend.request_accepted` | ✓ | opt | opt |
| `note.shared` | ✓ | opt | opt |
| `book.recommended` | ✓ | opt | opt |
| `finance.budget_warning` (migrate existing) | ✓ | ✓ | ✓ |
| `task.reminder` | ✓ | opt | ✓ |

### C3. Delivery order
1. **In-app (list, unread badge, mark read)** — **Done**:
   - `NotificationCenter.tsx` styled with distinct iconography and badge colors for all C2 events (`project.member_joined`, `share.invited`, `friend.request_received`, `friend.request_accepted`, `note.shared`, `book.recommended`, `finance.budget_warning`, `task.reminder`).
   - `NotificationContext.tsx` updated with immediate local Dexie mutation and background Supabase sync preserving `read_at` timestamps alongside `read` flags.
2. **Email**, in two separate paths:
   - **Auth emails** (signup confirmation, password reset, magic links): set
     Hostinger's SMTP as the custom SMTP in the Supabase dashboard
     (Auth settings). No code, and it avoids Supabase's built-in sender limits.
   - **App notification emails** (friend request, project joined, budget
     warning): provider-agnostic `sendEmail({ to, template, variables })`
     sitting behind the notification pipeline; templates versioned in repo.
3. **Push via device tokens and Capacitor Push** — **Done**:
   - Web / PWA push syncs subscriptions to `devices` table (`platform: 'web' | 'pwa'`).
   - Native Capacitor push in `useCapacitorPush.ts` syncs FCM / APNs tokens to `devices` table (`platform: 'android' | 'ios'`).
   - Edge Function `send-push` queries both `devices` and legacy tables with invalid token auto-pruning.

   **Hostinger SMTP Note:** Supabase docs state Edge Functions cannot connect out on standard SMTP ports. If 465 is blocked from Deno Edge, HTTPS email API (e.g. Resend) serves as the direct fallback.
   reported 465 working in 2024, but that contradicts the docs and could break
   without notice. Hostinger's SMTP uses the standard ports, so the app-emails
   path needs one of:
   1. **Test it first:** a throwaway Edge Function sending on 465. If it works,
      use it, but keep option 2 as the fallback.
   2. **HTTP email API** (Resend, Brevo, etc.) called over HTTPS from the Edge
      Function. It still sends from your own domain and sidesteps ports entirely.
   3. **A small sender outside Supabase** (for example on a Hostinger VPS or
      Node host) that the database or Edge Function calls.
   Also check Hostinger's sending limits for a mailbox: it is built for
   ordinary mail, not bulk notifications. Fine at launch, but worth knowing
   before the user base grows.
3. Push via device tokens and Capacitor Push — **M**

Notification preferences UI lives in Settings (Phase E).

---

## Phase D — Projects redesign

Bring Projects up to the current standard (grouped lists, floating pill
controls, neutral selection states, no rainbow accents).

- **List:** grouped rows with status, member avatars, progress; one "+" sheet (B3).
- **Detail:** header with progress and status; tabs for Tasks, Members, Activity.
- **Members:** list with role (owner / editor / viewer); owner can change roles
  and remove members.
- **Join flow:** enter code → preview project name and owner → confirm.
- **Notification:** when someone joins, the owner gets `project.member_joined`
  (Phase C).
- **Activity:** stub the feed now; fill it in Phase F6.

Reuses the existing `shared_items` table and the project → task inheritance.

---

## Phase E — Auth / Profile / Settings

**Status: redesign done.** Not planned here. What remains is confirming it left
room for the social work below; if a gap turns up, fix it inside the phase
that needs it:

- **Profile:** handle/username (unique), avatar, bio; entry points for Friends
  and requests; per-section visibility later (F4, F7).
- **Settings:**
  - Privacy — default visibility for new resources (default: private).
  - Notifications — the event × channel matrix from C2.
  - Devices — list of registered push devices, with revoke.
  - Account — export data, delete account (needs an Edge Function using the
    service-role key; this is the long-open item).
- **Sign-in:** resilient to offline (A1), with clear errors for expired links
  and unverified email.

---

## Phase F — Kairo Social

### F0. Foundations — **M**
- Shared vocabulary in code: `visibility: private | friends | shared | public`
  and `permission: viewer | editor`. Only `private` and `shared` are wired at
  first; the rest are reserved.
- Generalize `shared_items` into a single access table any resource type can use.
- **Local-first rules to settle now:**
  - Revoking access must remove the other person's local copy (their Dexie
    cache) on next sync, not just block future reads.
  - **PIN-locked notes cannot be shared.** The lock is a client-side UI gate,
    so sharing would leak the content.
  - **Journal notes stay private by default** and are excluded from share pickers.
- Write an RLS test matrix (owner / editor / viewer / stranger × read / write /
  delete) before shipping anything in F1–F5.

### F1. Friends — **L**
- Tables: `friend_requests`, `friendships` (store each pair once, ordered ids).
- Find people by exact handle or email only. No browse/search-all, to avoid
  user enumeration.
- States: add · pending · accept · decline · remove · block.
- Friendship grants **no access** to anything.

**Usernames (decision):** optional at signup, required before the first social
action (send a friend request, be found by handle, or publish). Signup stays
short, and people who never use social features are never blocked.
- Suggest a default from the email prefix, editable.
- Lowercase `a–z 0–9 _`, 3–20 characters, unique (case-insensitive index).
- Changeable but rate-limited (for example once per 30 days).
- Reserve obvious names (`admin`, `support`, `kairo`).

### F2. Sharing upgrade — **M**
- Pick a person (friend or by email/invite code), choose viewer/editor.
- Revoke, change permission, invitation expiry, email-bound invites.
- A "who has access" panel on every shared item.

### F3. Shared notes — **M**
- Private → shared, viewer/editor, revoke.
- **Conflict handling (upgrade from plain last-write-wins):** save with the
  version/`updated_at` you loaded. If it changed underneath you, show
  "Alex edited this — keep mine / take theirs / save mine as a copy." We just
  fixed a lost-update race in the journal; two people editing makes it far more
  likely. Still no CRDT or real-time in v1.

### F4. Books become social — **M**
- Visibility per book and per shelf: private / friends / public.
- Profile sections: Currently Reading, Want to Read, Recently Finished, each
  with its own visibility. Personal notes and quotes stay private.

### F5. Recommend / Send (one feature, not two) — **M**
Earlier drafts had "Recommend" and "Send" separately; they are the same
action with different payloads.

- `recommendations` table: sender, recipient, resource snapshot, message, state.
- The recipient gets a *copy or reference*, never access to the sender's record.
- Actions: add to library · already reading · already read · not interested.

### F6. Activity history — **M**
`activity_events` for shared resources, rendered as a timeline on projects and
shared notes. Add this before heavy multi-user editing, since it makes
collaboration understandable without real-time presence.

### F7. Public profiles — **L** (last)
Usernames become URLs, so this brings moderation and abuse concerns:
report, block, rate limits, and a preview of exactly what strangers see.
Nothing is ever public automatically; each resource opts in.

### F8. Groups — postponed
Deliberately deferred until F1–F7 are stable. The access table from F0 is
designed so groups can reuse it.

---

## Cross-cutting checklist (every phase)

- Migration file per schema change, named `YYYYMMDD_description.sql`,
  with a note that it must be run in the Supabase SQL editor.
- Dexie schema version bump for any new synced table, plus a decision on which
  new tables sync offline.
- RLS policy and a test for each new table.
- Empty, loading, error, and offline states for every new screen.
- `npm run verify` clean before each commit (tsc, eslint, build).

## Open questions

All earlier questions are answered (see "Decisions locked in" at the top).
Nothing is blocking the start of Phase A.

One result is pending by design: the C0 email spike decides SMTP versus an HTTPS
email API for notification emails.

Lock icons (decided, no action needed from you): a locked note card will keep
the padlock beside the title and drop the other two (the "Tap to unlock" line
icon and the footer badge).
