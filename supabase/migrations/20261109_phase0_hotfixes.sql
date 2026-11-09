-- Phase 0 Hotfixes (Kairo Implementation Plan v3)
-- Run this in the Supabase SQL editor.

-- 1. Ensure notes table columns match client expectations
alter table public.notes
  add column if not exists pinned boolean not null default false,
  add column if not exists folder text not null default 'All',
  add column if not exists word_count int not null default 0,
  add column if not exists is_template boolean not null default false,
  add column if not exists pin_hash text,
  add column if not exists updated_at timestamptz not null default now();

-- Ensure template check constraint covers all UI templates plus null
alter table public.notes drop constraint if exists notes_template_check;
alter table public.notes
  add constraint notes_template_check
  check (template in ('morning', 'evening', 'weekly-review', 'gratitude', 'book-notes', 'meeting-notes', 'free', 'freewrite', 'night', null));

create index if not exists notes_user_folder on public.notes(user_id, folder);
create index if not exists notes_user_pinned on public.notes(user_id, pinned);
create index if not exists notes_user_updated on public.notes(user_id, updated_at desc);

-- 2. Security hotfix: add cross-user auth guard to existing notify()
--    We preserve the full original function body (preferences, in-app, email dispatch).
--    The DEFAULT on p_payload must be kept or Postgres refuses CREATE OR REPLACE.
create or replace function public.notify(
  p_user_id  uuid,
  p_type     text,
  p_payload  jsonb DEFAULT '{}'::jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  pref_in_app  boolean;
  pref_email   boolean;
  pref_push    boolean;
  notif_id     uuid    := null;
  v_title      text;
  v_body       text;
  v_action_url text;
begin
  -- Phase 0.6 security guard: reject cross-user dispatch from authenticated clients
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'Unauthorized notification dispatch';
  end if;

  -- 1. Check user preferences or fall back to catalog defaults
  select np.in_app, np.email, np.push
  into pref_in_app, pref_email, pref_push
  from notification_preferences np
  where np.user_id = p_user_id and np.event_type = p_type;

  if not found then
    select def_in_app, def_email, def_push
    into pref_in_app, pref_email, pref_push
    from get_notification_defaults(p_type);
  end if;

  -- 2. Extract display fields with fallbacks
  v_title      := coalesce(p_payload->>'title', 'New Notification');
  v_body       := coalesce(p_payload->>'body', '');
  v_action_url := p_payload->>'action_url';

  -- 3. In-app delivery
  if coalesce(pref_in_app, true) = true then
    insert into notifications (
      user_id, title, body, type, action_url, payload, read, created_at
    )
    values (
      p_user_id, v_title, v_body, p_type, v_action_url, p_payload, false, now()
    )
    returning id into notif_id;
  end if;

  -- 4. Email delivery (fire-and-forget via pg_net; never blocks or fails the insert)
  if coalesce(pref_email, false) = true then
    perform dispatch_email(p_user_id, p_type, p_payload);
  end if;

  return notif_id;
end;
$$;

-- Revoke general execution from anon and public
revoke execute on function public.notify(uuid, text, jsonb) from public, anon;
grant  execute on function public.notify(uuid, text, jsonb) to authenticated, service_role;

-- 3. Security hotfix: redeem_share_code RPC
-- Allows a recipient to accept a share code safely without full update permissions on shared_items
create or replace function public.redeem_share_code(p_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to redeem share code';
  end if;

  select * into v_item
  from public.shared_items
  where code = upper(trim(p_code)) and status = 'pending';

  if not found then
    raise exception 'Invalid or expired share code';
  end if;

  -- Cannot accept own share
  if v_item.shared_by = auth.uid() then
    raise exception 'Cannot redeem your own share code';
  end if;

  update public.shared_items
  set status = 'accepted',
      shared_with_id = auth.uid()
  where id = v_item.id
  returning * into v_item;

  return to_jsonb(v_item);
end;
$$;

grant execute on function public.redeem_share_code(text) to authenticated;

