-- =====================================================================
-- 0002_functions.sql — 배분 로직 함수 + 트리거
-- 실행 전 0001_init.sql 이 먼저 실행되어 있어야 함.
-- 여러 번 실행해도 안전 (CREATE OR REPLACE).
-- =====================================================================

-- ───────── helper: 현재 사용자가 admin 인지 ─────────
create or replace function public.fn_is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin'
  );
$$;

-- ───────── helper: 활성 매니저 목록 (dispatch_order asc) ─────────
create or replace function public.fn_active_managers()
returns table (id uuid, dispatch_order int)
language sql
stable
security definer
set search_path = public
as $$
  select id, dispatch_order
  from public.profiles
  where role = 'manager'
    and active = true
    and dispatch_order is not null
  order by dispatch_order asc, created_at asc;
$$;

-- ───────── 신규 가입자 자동 profiles 생성 ─────────
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- ───────── 타임아웃 조회 (분) ─────────
create or replace function public.fn_dispatch_timeout_minutes()
returns int
language sql
stable
as $$
  select coalesce(
    (select (value->>'minutes')::int from public.app_settings where key = 'dispatch_timeout'),
    60
  );
$$;

-- ───────── 핵심: 다음 매니저에게 배분 ─────────
-- event_id 를 받아서:
--   1) 아직 시도하지 않은 매니저 중 다음 사람 결정
--   2) event_assignments 행 생성
--   3) 모두 거절했으면 event.status = 'declined_all'
-- 시작점:
--   - 이미 배분 시도가 있으면: 가장 큰 try_order 의 매니저 dispatch_order 다음 사람
--   - 첫 배분이면: dispatch_state.last_started_manager_id 다음 사람부터
create or replace function public.fn_dispatch_next(p_event_id uuid)
returns public.event_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_try_order      int;
  v_start_after    int;   -- 이 dispatch_order 보다 큰 첫 매니저부터 후보
  v_last_started   uuid;
  v_last_order     int;
  v_candidate_id   uuid;
  v_candidate_ord  int;
  v_timeout_min    int;
  v_result         public.event_assignments;
begin
  -- 1) 이번 시도 순번
  select coalesce(max(try_order), 0) + 1
    into v_try_order
    from public.event_assignments
    where event_id = p_event_id;

  -- 2) 시작점 결정
  if v_try_order = 1 then
    -- 첫 배분: dispatch_state.last_started_manager_id 의 다음 매니저부터
    select last_started_manager_id into v_last_started
      from public.dispatch_state where id = 1;

    if v_last_started is null then
      v_start_after := null;  -- 가장 앞에서 시작
    else
      select dispatch_order into v_last_order
        from public.profiles where id = v_last_started;
      v_start_after := v_last_order;
    end if;
  else
    -- 재배분: 직전 시도 매니저의 dispatch_order 다음 사람부터
    select p.dispatch_order
      into v_last_order
      from public.event_assignments ea
      join public.profiles p on p.id = ea.manager_id
      where ea.event_id = p_event_id
      order by ea.try_order desc
      limit 1;
    v_start_after := v_last_order;
  end if;

  -- 3) 후보 선정: dispatch_order 가 v_start_after 보다 큰 활성 매니저 중
  --    아직 이 일정에 시도되지 않은 사람의 가장 앞 사람
  select m.id, m.dispatch_order
    into v_candidate_id, v_candidate_ord
    from public.fn_active_managers() m
    where (v_start_after is null or m.dispatch_order > v_start_after)
      and not exists (
        select 1 from public.event_assignments ea
        where ea.event_id = p_event_id and ea.manager_id = m.id
      )
    order by m.dispatch_order asc
    limit 1;

  -- 4) 못 찾으면 처음부터 다시 한 바퀴
  if v_candidate_id is null then
    select m.id, m.dispatch_order
      into v_candidate_id, v_candidate_ord
      from public.fn_active_managers() m
      where not exists (
        select 1 from public.event_assignments ea
        where ea.event_id = p_event_id and ea.manager_id = m.id
      )
      order by m.dispatch_order asc
      limit 1;
  end if;

  -- 5) 그래도 없으면 → 모두 거절/소진 상태
  if v_candidate_id is null then
    update public.events
      set status = 'declined_all', updated_at = now()
      where id = p_event_id and status = 'dispatching';
    return null;
  end if;

  -- 6) 배분 행 생성
  v_timeout_min := public.fn_dispatch_timeout_minutes();

  insert into public.event_assignments
    (event_id, manager_id, try_order, status, notified_at, expires_at)
  values
    (p_event_id, v_candidate_id, v_try_order, 'notified', now(), now() + (v_timeout_min || ' minutes')::interval)
  returning * into v_result;

  return v_result;
end;
$$;

-- ───────── events INSERT 트리거 → 자동 배분 + 채팅방 생성 ─────────
create or replace function public.fn_on_event_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  -- 1) 일정용 채팅방 생성 (admin + 추후 배정자가 참여)
  insert into public.chat_rooms (name, kind, event_id, created_by)
  values (new.title, 'event', new.id, new.created_by)
  returning id into v_room_id;

  -- admin 모두를 멤버로
  insert into public.chat_room_members (room_id, profile_id)
  select v_room_id, p.id
  from public.profiles p
  where p.role = 'admin' and p.active = true
  on conflict do nothing;

  -- 2) 배분 시작
  perform public.fn_dispatch_next(new.id);

  return new;
end;
$$;

drop trigger if exists trg_on_event_inserted on public.events;
create trigger trg_on_event_inserted
  after insert on public.events
  for each row execute function public.fn_on_event_inserted();

-- ───────── 수락 ─────────
create or replace function public.fn_accept_assignment(p_assignment_id uuid)
returns public.event_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.event_assignments;
  v_first_try_manager_id uuid;
  v_room_id uuid;
begin
  select * into v_assignment
    from public.event_assignments
    where id = p_assignment_id
    for update;

  if v_assignment is null then
    raise exception '배분 정보를 찾을 수 없습니다';
  end if;

  if v_assignment.manager_id <> auth.uid() and not public.fn_is_admin() then
    raise exception '권한이 없습니다';
  end if;

  if v_assignment.status <> 'notified' then
    raise exception '이미 응답된 배분입니다 (현재 상태: %)', v_assignment.status;
  end if;

  -- 응답 기록
  update public.event_assignments
    set status = 'accepted', responded_at = now()
    where id = p_assignment_id
    returning * into v_assignment;

  -- 일정 확정
  update public.events
    set status = 'assigned',
        assigned_to = v_assignment.manager_id,
        updated_at = now()
    where id = v_assignment.event_id;

  -- 이 일정의 try_order=1 매니저를 dispatch_state 에 기록 (다음 일정은 그 다음 사람부터)
  select manager_id into v_first_try_manager_id
    from public.event_assignments
    where event_id = v_assignment.event_id and try_order = 1;

  update public.dispatch_state
    set last_started_manager_id = v_first_try_manager_id,
        updated_at = now()
    where id = 1;

  -- 수락한 매니저를 일정 채팅방에 추가
  select id into v_room_id
    from public.chat_rooms
    where kind = 'event' and event_id = v_assignment.event_id
    limit 1;

  if v_room_id is not null then
    insert into public.chat_room_members (room_id, profile_id)
    values (v_room_id, v_assignment.manager_id)
    on conflict do nothing;
  end if;

  return v_assignment;
end;
$$;

-- ───────── 거절 ─────────
create or replace function public.fn_decline_assignment(
  p_assignment_id uuid,
  p_reason text default null
)
returns public.event_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.event_assignments;
begin
  select * into v_assignment
    from public.event_assignments
    where id = p_assignment_id
    for update;

  if v_assignment is null then
    raise exception '배분 정보를 찾을 수 없습니다';
  end if;

  if v_assignment.manager_id <> auth.uid() and not public.fn_is_admin() then
    raise exception '권한이 없습니다';
  end if;

  if v_assignment.status <> 'notified' then
    raise exception '이미 응답된 배분입니다 (현재 상태: %)', v_assignment.status;
  end if;

  update public.event_assignments
    set status = 'declined',
        responded_at = now(),
        decline_reason = p_reason
    where id = p_assignment_id
    returning * into v_assignment;

  -- 즉시 다음 매니저에게 재배분
  perform public.fn_dispatch_next(v_assignment.event_id);

  return v_assignment;
end;
$$;

-- ───────── 타임아웃 만료 처리 (2단계에서 Cron 으로 호출 예정) ─────────
-- 지금은 함수만 정의. 호출 안 함.
create or replace function public.fn_expire_assignments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count int := 0;
begin
  for v_row in
    select id, event_id
      from public.event_assignments
      where status = 'notified' and expires_at <= now()
  loop
    update public.event_assignments
      set status = 'expired', responded_at = now()
      where id = v_row.id;
    perform public.fn_dispatch_next(v_row.event_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
