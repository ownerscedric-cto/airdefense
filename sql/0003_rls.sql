-- =====================================================================
-- 0003_rls.sql — Row Level Security 정책
-- 실행 전 0001, 0002 가 먼저 실행되어 있어야 함.
-- 여러 번 실행해도 안전 (DROP POLICY IF EXISTS).
-- =====================================================================

-- ───────── RLS 활성화 ─────────
alter table public.profiles            enable row level security;
alter table public.service_types       enable row level security;
alter table public.app_settings        enable row level security;
alter table public.events              enable row level security;
alter table public.event_assignments   enable row level security;
alter table public.dispatch_state      enable row level security;
alter table public.chat_rooms          enable row level security;
alter table public.chat_room_members   enable row level security;
alter table public.chat_messages       enable row level security;

-- ───────── profiles ─────────
-- 본인 row 조회/수정 (단, role/dispatch_order 는 update 시 변경 불가 — 트리거로 제어)
-- admin 은 전체 조회/수정
-- 인증된 사용자는 active=true 인 모든 프로필 조회 가능 (멤버 목록 표시용)

drop policy if exists profiles_select_self_or_active on public.profiles;
create policy profiles_select_self_or_active on public.profiles
  for select
  using (
    auth.uid() = id
    or active = true
    or public.fn_is_admin()
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

-- 본인이 자기 role/dispatch_order 를 못 바꾸도록 트리거
create or replace function public.fn_protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_is_admin(auth.uid()) then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception '역할 변경 권한이 없습니다';
  end if;
  if new.dispatch_order is distinct from old.dispatch_order then
    raise exception '배분 순서 변경 권한이 없습니다';
  end if;
  if new.active is distinct from old.active then
    raise exception '활성 상태 변경 권한이 없습니다';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_fields on public.profiles;
create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row execute function public.fn_protect_profile_fields();

-- ───────── service_types ─────────
-- 모든 인증 사용자 read, admin write

drop policy if exists service_types_select_all on public.service_types;
create policy service_types_select_all on public.service_types
  for select using (auth.uid() is not null);

drop policy if exists service_types_admin_write on public.service_types;
create policy service_types_admin_write on public.service_types
  for all
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

-- ───────── app_settings ─────────
-- 모든 인증 사용자 read, admin write

drop policy if exists app_settings_select_all on public.app_settings;
create policy app_settings_select_all on public.app_settings
  for select using (auth.uid() is not null);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

-- ───────── events ─────────
-- approved(pending 아님) 사용자 read, admin write, manager 는 자기 assigned_to 인 event 의 status 만 변경

drop policy if exists events_select_approved on public.events;
create policy events_select_approved on public.events
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager', 'viewer')
    )
  );

drop policy if exists events_admin_insert on public.events;
create policy events_admin_insert on public.events
  for insert
  with check (public.fn_is_admin());

drop policy if exists events_admin_update on public.events;
create policy events_admin_update on public.events
  for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

drop policy if exists events_admin_delete on public.events;
create policy events_admin_delete on public.events
  for delete
  using (public.fn_is_admin());

-- manager 본인 일정 완료/취소 표시
drop policy if exists events_manager_update_status on public.events;
create policy events_manager_update_status on public.events
  for update
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- ───────── event_assignments ─────────
-- 본인이 manager 인 것 + admin 전체 read
-- INSERT/UPDATE 는 함수(security definer)로만 — 직접 변경 금지

drop policy if exists assignments_select_mine_or_admin on public.event_assignments;
create policy assignments_select_mine_or_admin on public.event_assignments
  for select using (
    manager_id = auth.uid() or public.fn_is_admin()
  );

-- INSERT/UPDATE/DELETE 정책 없음 → 함수로만 변경 가능

-- ───────── dispatch_state ─────────
drop policy if exists dispatch_state_select_admin on public.dispatch_state;
create policy dispatch_state_select_admin on public.dispatch_state
  for select using (public.fn_is_admin());

-- ───────── chat_rooms ─────────
-- 멤버만 read
-- admin 은 모든 방 read/write
-- 인증된 사용자(approved)는 general 방 생성 가능? → 일단 admin 만
-- general 방은 자동 생성된 것 외 admin 이 만들 수 있음

drop policy if exists chat_rooms_select_member_or_admin on public.chat_rooms;
create policy chat_rooms_select_member_or_admin on public.chat_rooms
  for select using (
    public.fn_is_admin()
    or exists (
      select 1 from public.chat_room_members crm
      where crm.room_id = chat_rooms.id and crm.profile_id = auth.uid()
    )
  );

drop policy if exists chat_rooms_admin_write on public.chat_rooms;
create policy chat_rooms_admin_write on public.chat_rooms
  for all
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

-- ───────── chat_room_members ─────────

drop policy if exists chat_members_select on public.chat_room_members;
create policy chat_members_select on public.chat_room_members
  for select using (
    public.fn_is_admin()
    or profile_id = auth.uid()
    or exists (
      select 1 from public.chat_room_members crm2
      where crm2.room_id = chat_room_members.room_id and crm2.profile_id = auth.uid()
    )
  );

drop policy if exists chat_members_admin_write on public.chat_room_members;
create policy chat_members_admin_write on public.chat_room_members
  for all
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

-- 본인의 last_read_at 갱신은 본인이 가능
drop policy if exists chat_members_self_update on public.chat_room_members;
create policy chat_members_self_update on public.chat_room_members
  for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ───────── chat_messages ─────────
-- 방 멤버만 read / write (본인 sender_id)
-- 본인 메시지만 soft delete

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member on public.chat_messages
  for select using (
    public.fn_is_admin()
    or exists (
      select 1 from public.chat_room_members crm
      where crm.room_id = chat_messages.room_id and crm.profile_id = auth.uid()
    )
  );

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member on public.chat_messages
  for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_room_members crm
      where crm.room_id = chat_messages.room_id and crm.profile_id = auth.uid()
    )
  );

drop policy if exists chat_messages_update_own on public.chat_messages;
create policy chat_messages_update_own on public.chat_messages
  for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());
