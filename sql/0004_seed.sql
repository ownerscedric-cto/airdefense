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
-- Google OAuth 로 로그인하면 auth.users + profiles 행이 자동 생성된다 (role='pending').
-- 본인 로그인 후, 본인 이메일을 아래에 넣어 한 번만 실행하면 admin 으로 승격된다.
--
-- 사용 예:
--   update public.profiles
--     set role = 'admin', active = true
--     where email = 'geese3433@gmail.com';
--
-- =====================================================================

-- 본인 이메일을 안다면 미리 자동 승격되도록 아래 주석 해제 후 실행
-- update public.profiles
--   set role = 'admin', active = true
--   where email = 'geese3433@gmail.com';
