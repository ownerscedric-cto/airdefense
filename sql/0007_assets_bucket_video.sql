-- =====================================================================
-- 0007_assets_bucket_video.sql
--
-- 'assets' 버킷의 파일 용량 한도를 100MB 로 올리고, 동영상 MIME 허용.
-- 0006 을 이미 실행한 환경용 변경 SQL.
-- 신규 환경에서는 0006 만 실행해도 동일한 결과가 나오도록 0006 도 같이 갱신함.
-- =====================================================================

-- 1) 버킷 설정 변경 (이미 존재한다고 가정)
update storage.buckets
set
  file_size_limit = 104857600,   -- 100 MB
  allowed_mime_types = array[
    -- 이미지
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    -- 동영상
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
where id = 'assets';

-- 2) (안전망) 버킷이 없으면 새로 만들기 — 0006 누락 시 대응
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  false,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do nothing;
