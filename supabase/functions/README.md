# Supabase Edge Functions

`sync-google-sheet` — 구글 시트의 일정을 `public.events` 에 5분마다 단방향 동기화.

## 사전 준비 (한 번만)

### 1. Google Cloud 서비스 계정

1. https://console.cloud.google.com 접속
2. 새 프로젝트 또는 기존 프로젝트 선택
3. **APIs & Services → Library** 에서 **Google Sheets API** 활성화
4. **APIs & Services → Credentials → + CREATE CREDENTIALS → Service account**
   - 이름: `airdefense-sheet-sync` (자유)
   - Role: 없음 (Sheets 권한은 시트에 직접 공유로 부여)
5. 생성된 서비스 계정 클릭 → **Keys → ADD KEY → Create new key → JSON**
   - 다운로드된 JSON 파일을 안전히 보관 (이후 Supabase secret 으로 등록)
6. 서비스 계정 이메일 복사 (예: `airdefense-sheet-sync@xxx.iam.gserviceaccount.com`)

### 2. 동기화 대상 구글 시트

1. 본사 시트를 열고 **공유** → 위에서 복사한 서비스 계정 이메일을 **편집자** 권한으로 추가
   - "편집자" 가 필요한 이유: 행에 시스템 ID 를 자동으로 채워 넣기 때문.
   - 시스템 ID 자동 부여를 끄려면 권한을 "뷰어" 로 두고, `column_map.sheet_row_id` 컬럼명을 빈 문자열로 설정
2. 시트 URL 에서 `spreadsheet_id` 추출
   - `https://docs.google.com/spreadsheets/d/<여기>/edit`
3. 헤더 행이 어떤 컬럼명을 쓰는지 확인 후 SQL 의 `column_map` 과 일치시킬 것

### 3. 시트에 새 컬럼 추가 (권장)

시트 헤더에 다음 컬럼을 추가:
- **시스템 ID** — 빈 값으로 두면 동기화 시 앱이 UUID 를 자동으로 채움. 절대 사용자가 수정하지 말 것.

## Supabase 설정

### 1. SQL 마이그레이션 실행

```
sql/0005_sheet_sync.sql
```

`app_settings.sheet_sync` 행이 만들어짐. 아래 SQL 로 본인 시트 정보를 채워넣기:

```sql
update public.app_settings
set value = jsonb_set(
  jsonb_set(
    jsonb_set(value, '{enabled}', 'true'::jsonb),
    '{spreadsheet_id}', '"<여기에-시트-ID>"'::jsonb
  ),
  '{sheet_name}', '"<여기에-탭-이름>"'::jsonb
)
where key = 'sheet_sync';
```

컬럼 매핑이 다르면:

```sql
update public.app_settings
set value = jsonb_set(
  value,
  '{column_map}',
  '{
    "date":         "날짜",
    "time":         "시각",
    "service_type": "서비스",
    "customer":     "고객명",
    "address":      "주소",
    "size":         "평수",
    "layout":       "구조",
    "notes":        "메모",
    "sheet_row_id": "시스템 ID"
  }'::jsonb
)
where key = 'sheet_sync';
```

### 2. Edge Function 배포

로컬에 Supabase CLI 설치 후:

```bash
supabase login
supabase link --project-ref pbwcwwbsynukbzildpef

# 서비스 계정 JSON 을 secret 으로 등록 (한 줄 stringify)
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat /path/to/service-account.json)"

# Edge Function 배포
supabase functions deploy sync-google-sheet
```

### 3. 수동 호출 테스트

```bash
curl -X POST \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  https://pbwcwwbsynukbzildpef.supabase.co/functions/v1/sync-google-sheet
```

응답에 `{ "status": "success", "upserted": N, "cancelled": M }` 가 나오면 정상.

### 4. Cron 자동 호출 (5분마다)

Supabase Dashboard → **Database → Cron** 에서 새 Job:

```sql
select cron.schedule(
  'sync-google-sheet',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://pbwcwwbsynukbzildpef.supabase.co/functions/v1/sync-google-sheet',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.anon_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);
```

또는 GitHub Actions / Vercel Cron / cron-job.org 같은 외부 스케줄러로도 가능.

## 동기화 결과 확인

```sql
select value
from public.app_settings
where key = 'sheet_sync';
```

`last_sync_at`, `last_sync_status`, `last_sync_error` 필드 확인.

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `시트 읽기 실패 (403)` | 서비스 계정에 시트 공유 안 됨 | 시트 공유 → 서비스 계정 이메일 추가 |
| `필수 컬럼이 시트에서 안 보임` | `column_map` 헤더명 불일치 | 시트 실제 헤더와 `column_map` 일치시키기 |
| `행 N 시각 파싱 실패` | 날짜/시각 형식이 헬퍼가 못 읽는 형태 | 시트 셀 형식을 `YYYY-MM-DD` / `HH:mm` 으로 |
| `admin 사용자가 없습니다` | profiles 에 admin 없음 | `sql/0004_seed.sql` 의 admin 부트스트랩 실행 |

## 향후 확장

- **양방향 동기화**: 매니저가 수락/거절하면 시트의 "상태" 컬럼에 표시
- **여러 시트 지원**: 지부별로 별도 시트 → `sheet_source` 로 구분
- **요구사항 자유 텍스트 파싱**: `notes` 내 "마루 보호 필수" 같은 키워드 자동 태깅
