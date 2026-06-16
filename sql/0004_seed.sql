-- =====================================================================
-- 0004_seed.sql — 초기 데이터 + 부트스트랩
-- 실행 전 0001, 0002, 0003 가 먼저 실행되어 있어야 함.
-- 여러 번 실행해도 안전 (ON CONFLICT DO NOTHING).
-- =====================================================================

-- ───────── 서비스 종류 시드 ─────────
insert into public.service_types (code, label, description, sort_order)
values
  ('housewarming',    '새집증후군 시공', '습식 베이크아웃 기반 유해물질 제거', 10),
  ('move_in_cleaning', '입주 청소',     '대표 매니저가 팀 운영', 20)
on conflict (code) do nothing;

-- ───────── 타임아웃 기본값 (1시간) ─────────
insert into public.app_settings (key, value)
values ('dispatch_timeout', jsonb_build_object('minutes', 60))
on conflict (key) do nothing;

-- ───────── 전체 채팅방 (general) 시드 ─────────
-- 한 번만 만들어지고, 모든 active 사용자가 자동 가입되도록 별도 함수 호출은 앱에서 처리.
-- 여기서는 방만 미리 만들어 둠.
insert into public.chat_rooms (id, name, kind, created_by)
select uuid_generate_v4(), '전체 알림', 'general', null
where not exists (
  select 1 from public.chat_rooms where kind = 'general' and name = '전체 알림'
);

-- =====================================================================
-- ★★★ 첫 admin 부트스트랩 ★★★
--
-- 0002_functions.sql / 0003_rls.sql 의 fn_protect_profile_fields 트리거가
-- "본인이 admin 이 아니면 role 변경 금지" 를 강제한다.
-- 따라서 첫 admin 은 닭과 달걀 문제 → 트리거를 일시 우회해서 승격해야 한다.
--
-- 절차:
--   1) Google OAuth 로 한 번 로그인 → profiles 행 자동 생성 (role='pending')
--   2) 본인 이메일을 아래에 적고 블록 전체를 SQL Editor 에서 실행
--   3) 이후엔 트리거가 정상 동작 → admin 이 된 본인이 다른 사용자를 관리
-- =====================================================================

-- 본인 이메일을 적고 아래 블록 주석 해제 후 한 번만 실행
-- do $$
-- declare v_email text := 'geese3433@gmail.com';
-- begin
--   set local session_replication_role = replica;
--   update public.profiles
--     set role = 'admin', active = true
--     where email = v_email;
--   set local session_replication_role = default;
-- end $$;
