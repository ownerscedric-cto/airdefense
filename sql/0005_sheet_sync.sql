-- =====================================================================
-- 0005_sheet_sync.sql — 구글 시트 동기화 지원
--
-- 실행 순서: 0001~0004 가 먼저 실행되어 있어야 함.
-- 여러 번 실행해도 안전 (IF NOT EXISTS / OR REPLACE).
--
-- 동기화 모델 (단방향: 시트 → events):
--   1) Edge Function 이 서비스 계정으로 시트 읽음
--   2) 각 행 → events 테이블 upsert
--      · 신규 행 (sheet_row_id 없음 또는 events 에 없음) → INSERT
--        → 트리거가 자동으로 배분 시작
--      · 기존 행 (sheet_row_id 매칭) → UPDATE
--      · 시트에서 사라진 행 → status='cancelled' (hard delete 안 함)
--   3) sheet_raw 컬럼에 원본 row 전체 jsonb 보관 (디버깅·재처리용)
-- =====================================================================

-- ───────── events 테이블 보강 ─────────
alter table public.events
  add column if not exists sheet_row_id text,            -- 시트 행 ID (앱이 부여)
  add column if not exists sheet_source text,            -- 어느 시트에서 왔는지 식별 (탭 이름 등)
  add column if not exists sheet_raw jsonb,              -- 원본 row 데이터 (디버깅·재파싱)
  add column if not exists sheet_synced_at timestamptz;  -- 마지막 동기화 시각

create unique index if not exists ux_events_sheet_row
  on public.events (sheet_row_id)
  where sheet_row_id is not null;

-- ───────── 시트 동기화 설정 (app_settings 에 저장) ─────────
-- 시트 구조가 바뀌어도 SQL 수정 없이 매핑 변경 가능하도록 설정 테이블에 보관.
insert into public.app_settings (key, value)
values (
  'sheet_sync',
  jsonb_build_object(
    'enabled', false,
    'spreadsheet_id', '',
    'sheet_name', 'Sheet1',
    'header_row', 1,
    'first_data_row', 2,
    -- 컬럼 매핑: 시트 헤더명 → events 필드
    'column_map', jsonb_build_object(
      'date',         '날짜',
      'time',         '시각',
      'service_type', '서비스',
      'customer',     '고객명',
      'address',      '주소',
      'size',         '평수',
      'layout',       '구조',
      'notes',        '메모',
      'sheet_row_id', '시스템 ID'    -- 앱이 채우는 컬럼명
    ),
    -- 서비스 종류 매핑 (시트의 한글 라벨 → events.service_type 코드)
    'service_map', jsonb_build_object(
      '새집증후군', 'housewarming',
      '입주청소',   'move_in_cleaning',
      '입주 청소',  'move_in_cleaning'
    ),
    'last_sync_at', null,
    'last_sync_status', null,
    'last_sync_error', null
  )
)
on conflict (key) do nothing;

-- ───────── upsert 함수: Edge Function 에서 호출 ─────────
-- 시트의 한 행을 받아서 events 에 반영. INSERT 시 배분 트리거가 자동 실행됨.
--
-- 입력 파라미터:
--   p_row_id        : 시트 행의 고유 ID (앱이 부여, "시스템 ID" 컬럼 값)
--   p_service_type  : 'housewarming' / 'move_in_cleaning' / ...
--   p_title         : 일정 제목 (보통 "고객명 평수" 또는 주소)
--   p_starts_at     : 시작 시각 timestamptz
--   p_ends_at       : 종료 시각 (없으면 null)
--   p_customer/p_address/p_size/p_layout/p_notes
--   p_sheet_source  : 시트/탭 식별자
--   p_raw           : 원본 row jsonb
--   p_created_by    : 동기화 실행한 사용자 (없으면 첫 admin)
create or replace function public.fn_upsert_event_from_sheet(
  p_row_id        text,
  p_service_type  text,
  p_title         text,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz default null,
  p_customer      text default null,
  p_address       text default null,
  p_size          text default null,
  p_layout        text default null,
  p_notes         text default null,
  p_sheet_source  text default null,
  p_raw           jsonb default null,
  p_created_by    uuid default null
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.events;
  v_creator  uuid;
  v_result   public.events;
begin
  if p_row_id is null or btrim(p_row_id) = '' then
    raise exception 'sheet_row_id 가 비어 있습니다';
  end if;

  -- created_by 결정: 명시 안 됐으면 첫 admin
  if p_created_by is null then
    select id into v_creator
      from public.profiles
      where role = 'admin' and active = true
      order by created_at asc
      limit 1;
    if v_creator is null then
      raise exception 'admin 사용자가 없습니다. 부트스트랩 먼저 진행하세요.';
    end if;
  else
    v_creator := p_created_by;
  end if;

  -- 기존 행 조회
  select * into v_existing
    from public.events
    where sheet_row_id = p_row_id
    limit 1;

  if v_existing.id is null then
    -- 신규 INSERT → 배분 트리거 자동 실행
    insert into public.events (
      service_type, title, starts_at, ends_at,
      customer, address, size, layout, notes,
      sheet_row_id, sheet_source, sheet_raw, sheet_synced_at,
      created_by
    ) values (
      p_service_type, p_title, p_starts_at, p_ends_at,
      p_customer, p_address, p_size, p_layout, p_notes,
      p_row_id, p_sheet_source, p_raw, now(),
      v_creator
    )
    returning * into v_result;
  else
    -- 기존 UPDATE (cancelled/completed 인 일정은 시트에서 바꿔도 그대로 둠 — 안전)
    if v_existing.status in ('cancelled', 'completed') then
      update public.events
        set sheet_raw = p_raw,
            sheet_synced_at = now()
        where id = v_existing.id
        returning * into v_result;
    else
      update public.events
        set service_type = p_service_type,
            title = p_title,
            starts_at = p_starts_at,
            ends_at = p_ends_at,
            customer = p_customer,
            address = p_address,
            size = p_size,
            layout = p_layout,
            notes = p_notes,
            sheet_source = p_sheet_source,
            sheet_raw = p_raw,
            sheet_synced_at = now()
        where id = v_existing.id
        returning * into v_result;
    end if;
  end if;

  return v_result;
end;
$$;

-- ───────── 시트에서 사라진 행 cancel 처리 ─────────
-- Edge Function 이 시트 한 번 다 읽은 후, 이번 동기화에 포함되지 않은
-- sheet_row_id 의 일정을 cancelled 로 표시. (배정된 매니저가 있으면 채팅 알림 별도)
create or replace function public.fn_cancel_missing_sheet_events(
  p_present_row_ids text[],
  p_sheet_source    text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.events
    set status = 'cancelled',
        updated_at = now()
    where sheet_source = p_sheet_source
      and sheet_row_id is not null
      and sheet_row_id <> all (p_present_row_ids)
      and status not in ('cancelled', 'completed');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ───────── 동기화 결과 기록 ─────────
create or replace function public.fn_record_sheet_sync(
  p_status text,         -- 'success' / 'error'
  p_error  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_settings
    set value = jsonb_set(
          jsonb_set(
            jsonb_set(value, '{last_sync_at}', to_jsonb(now()::text)),
            '{last_sync_status}', to_jsonb(p_status)
          ),
          '{last_sync_error}', case when p_error is null then 'null'::jsonb else to_jsonb(p_error) end
        ),
        updated_at = now()
    where key = 'sheet_sync';
end;
$$;
