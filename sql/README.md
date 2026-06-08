# SQL 마이그레이션

Supabase 데이터베이스 스키마 / 함수 / 정책 정의.

## 실행 순서

번호 순서대로 Supabase 대시보드 → SQL Editor 에 붙여넣고 실행한다.

1. `0001_init.sql` — 테이블/인덱스 생성
2. `0002_functions.sql` — 배분 로직 함수와 트리거
3. `0003_rls.sql` — Row Level Security 정책
4. `0004_seed.sql` — 초기 데이터 (서비스 종류 등) + admin 부트스트랩 가이드

각 파일은 **idempotent**(여러 번 실행해도 같은 결과) 하게 작성되어 있다 — `IF NOT EXISTS` / `DROP ... IF EXISTS` 사용. 그래서 스키마 수정 시 해당 파일만 다시 실행하면 된다.

## 스키마 개요

```
profiles                  # 사용자 + 역할 + 매니저 배분 순서
service_types             # 서비스 종류 (새집증후군 / 입주청소 / ...)
events                    # 시공 일정 (마스터)
event_assignments         # 일정별 배분 시도 이력
dispatch_state            # 라운드로빈 상태 (싱글톤)
app_settings              # 시스템 설정 (타임아웃 분 등)
chat_rooms                # 채팅방 (general / event / private)
chat_room_members         # 채팅방 멤버십
chat_messages             # 채팅 메시지
```

## 배분 로직 요약

1. `events` INSERT → `fn_dispatch_next(event_id)` 트리거 호출
2. `fn_dispatch_next` — 라운드로빈으로 다음 매니저 선정, `event_assignments` 행 생성, `expires_at = now() + 타임아웃`
3. 매니저가 응답:
   - 수락 → `fn_accept_assignment`: event 확정, dispatch_state 갱신
   - 거절 → `fn_decline_assignment`: 다음 매니저에게 자동 재배정
4. 타임아웃 처리(`fn_expire_assignments`)는 2단계(Cron)에서 활성화. 1단계에서는 함수만 정의해두고 호출 안 함.

## 역할 (role)

- `pending` — 가입 직후, 데이터 접근 불가
- `viewer` — 일정 보기만
- `manager` — 배분 대상, 본인 일정 응답/완료, 채팅 참여
- `admin` — 전체 관리

## 첫 admin 부트스트랩

`0004_seed.sql` 내용 참고. 본인 이메일로 구글 로그인 후, SQL Editor에서 role 을 admin 으로 수동 변경한다.
