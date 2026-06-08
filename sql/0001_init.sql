-- =====================================================================
-- 0001_init.sql — 테이블/인덱스 생성
-- 실행: Supabase Dashboard → SQL Editor → 붙여넣기 → Run
-- 여러 번 실행해도 안전 (idempotent)
-- =====================================================================

-- ───────── 확장 ─────────
create extension if not exists "uuid-ossp";

-- ───────── profiles ─────────
-- auth.users 와 1:1. 신규 가입자는 pending 상태로 자동 생성됨 (트리거는 0002에서).
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  name          text,
  phone         text,
  role          text not null default 'pending'
                  check (role in ('pending', 'viewer', 'manager', 'admin')),
  dispatch_order int,                 -- manager 일 때만 사용. 낮은 번호부터 라운드로빈.
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_dispatch_order on public.profiles (dispatch_order) where role = 'manager' and active = true;

-- ───────── service_types ─────────
-- 새집증후군 / 입주 청소 / 추후 확장.
create table if not exists public.service_types (
  code         text primary key,    -- 예: 'housewarming', 'move_in_cleaning'
  label        text not null,       -- 예: '새집증후군 시공', '입주 청소'
  description  text,
  active       boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ───────── app_settings ─────────
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ───────── events ─────────
create table if not exists public.events (
  id           uuid primary key default uuid_generate_v4(),
  service_type text not null references public.service_types(code),
  title        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  customer     text,
  address      text,
  size         text,
  layout       text,
  notes        text,
  status       text not null default 'dispatching'
                 check (status in ('dispatching', 'assigned', 'declined_all', 'completed', 'cancelled')),
  assigned_to  uuid references public.profiles(id),
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_events_starts_at on public.events (starts_at);
create index if not exists idx_events_status on public.events (status);
create index if not exists idx_events_assigned_to on public.events (assigned_to);

-- ───────── event_assignments ─────────
-- 한 일정에 매니저당 1행. try_order 로 시도 순서 추적.
create table if not exists public.event_assignments (
  id            uuid primary key default uuid_generate_v4(),
  event_id      uuid not null references public.events(id) on delete cascade,
  manager_id    uuid not null references public.profiles(id),
  try_order     int not null,
  status        text not null default 'notified'
                  check (status in ('notified', 'accepted', 'declined', 'expired', 'skipped')),
  notified_at   timestamptz not null default now(),
  expires_at    timestamptz not null,
  responded_at  timestamptz,
  decline_reason text,
  unique (event_id, manager_id)
);

create index if not exists idx_event_assignments_event on public.event_assignments (event_id);
create index if not exists idx_event_assignments_manager on public.event_assignments (manager_id);
create index if not exists idx_event_assignments_status on public.event_assignments (status);
create index if not exists idx_event_assignments_expires on public.event_assignments (expires_at) where status = 'notified';

-- ───────── dispatch_state (싱글톤) ─────────
create table if not exists public.dispatch_state (
  id                       int primary key check (id = 1),
  last_started_manager_id  uuid references public.profiles(id),
  updated_at               timestamptz not null default now()
);

-- 싱글톤 시드
insert into public.dispatch_state (id, last_started_manager_id)
values (1, null)
on conflict (id) do nothing;

-- ───────── chat_rooms ─────────
create table if not exists public.chat_rooms (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  kind       text not null default 'general'
               check (kind in ('general', 'event', 'private')),
  event_id   uuid references public.events(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_rooms_kind on public.chat_rooms (kind);
create index if not exists idx_chat_rooms_event on public.chat_rooms (event_id);

-- ───────── chat_room_members ─────────
create table if not exists public.chat_room_members (
  room_id      uuid not null references public.chat_rooms(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (room_id, profile_id)
);

create index if not exists idx_chat_room_members_profile on public.chat_room_members (profile_id);

-- ───────── chat_messages ─────────
create table if not exists public.chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  room_id     uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id),
  body        text not null,
  attachments jsonb,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_chat_messages_room_created on public.chat_messages (room_id, created_at desc);

-- ───────── updated_at 자동 갱신 트리거 (재사용) ─────────
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.fn_set_updated_at();
