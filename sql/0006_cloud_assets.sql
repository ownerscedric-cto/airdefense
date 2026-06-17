-- =====================================================================
-- 0006_cloud_assets.sql — 클라우드 자산 (이미지·동영상)
--
-- 모든 팀원이 공유하는 공통 자산 라이브러리. Supabase Storage 사용.
--
-- 흐름:
--   1) 클라이언트에서 이미지 선택
--   2) Storage bucket 'assets' 에 업로드 (path: <kind>/<uuid>.<ext>)
--   3) cloud_assets 테이블에 메타데이터 INSERT
--   4) 메시지 첨부 시 cloud_assets.id 를 참조 (job.messageAttachments 의 ID 와 호환)
-- =====================================================================

-- ───────── cloud_assets ─────────
create table if not exists public.cloud_assets (
  id            uuid primary key default uuid_generate_v4(),
  kind          text not null check (kind in ('common', 'shot')),
  name          text not null,
  storage_path  text not null,                          -- 'assets' bucket 내 경로
  mime_type     text,
  size_bytes    bigint,
  width         int,
  height        int,
  thumb_data_url text,                                  -- 작은 썸네일 (base64)
  tags          text[] not null default '{}',
  event_id      uuid references public.events(id) on delete set null,  -- kind='shot' 일 때
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_cloud_assets_kind on public.cloud_assets (kind);
create index if not exists idx_cloud_assets_event on public.cloud_assets (event_id);
create index if not exists idx_cloud_assets_created_at on public.cloud_assets (created_at desc);

-- updated_at 자동 갱신
drop trigger if exists trg_cloud_assets_updated_at on public.cloud_assets;
create trigger trg_cloud_assets_updated_at
  before update on public.cloud_assets
  for each row execute function public.fn_set_updated_at();

-- ───────── RLS ─────────
alter table public.cloud_assets enable row level security;

-- 모든 approved 사용자 read
drop policy if exists cloud_assets_select_approved on public.cloud_assets;
create policy cloud_assets_select_approved on public.cloud_assets
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager', 'viewer')
    )
  );

-- admin 만 INSERT (manager/viewer 는 읽기만)
drop policy if exists cloud_assets_insert on public.cloud_assets;
create policy cloud_assets_insert on public.cloud_assets
  for insert
  with check (
    created_by = auth.uid()
    and public.fn_is_admin()
  );

-- 본인 자산만 UPDATE (이름·태그 변경) + admin 전체
drop policy if exists cloud_assets_update_own_or_admin on public.cloud_assets;
create policy cloud_assets_update_own_or_admin on public.cloud_assets
  for update
  using (created_by = auth.uid() or public.fn_is_admin())
  with check (created_by = auth.uid() or public.fn_is_admin());

-- 본인 자산만 DELETE + admin 전체
drop policy if exists cloud_assets_delete_own_or_admin on public.cloud_assets;
create policy cloud_assets_delete_own_or_admin on public.cloud_assets
  for delete
  using (created_by = auth.uid() or public.fn_is_admin());

-- =====================================================================
-- ★ Storage bucket 'assets' 생성 + 정책 (별도 SQL Editor 에서 한 번만 실행)
-- =====================================================================
-- 아래는 supabase-js Storage API 또는 대시보드에서 만들 수도 있지만,
-- SQL 로 한 번에 처리하기 위해 명시.
--
-- 1) Storage → Buckets → 'assets' (Private) 생성
--    또는 아래 INSERT 한 번 실행:
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  false,                                            -- private (signed URL 로 접근)
  104857600,                                        -- 100 MB
  array[
    -- 이미지
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    -- 동영상
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do nothing;

-- 2) Storage 정책: approved 사용자 read, admin/manager write
--    storage.objects 에 RLS 정책 추가
drop policy if exists "assets_read_approved" on storage.objects;
create policy "assets_read_approved" on storage.objects
  for select
  using (
    bucket_id = 'assets'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'manager', 'viewer')
    )
  );

-- admin 만 업로드. manager/viewer 는 읽기만.
drop policy if exists "assets_insert_admin_manager" on storage.objects;
drop policy if exists "assets_insert_admin" on storage.objects;
create policy "assets_insert_admin" on storage.objects
  for insert
  with check (
    bucket_id = 'assets'
    and public.fn_is_admin()
  );

drop policy if exists "assets_update_own_or_admin" on storage.objects;
create policy "assets_update_own_or_admin" on storage.objects
  for update
  using (
    bucket_id = 'assets'
    and (owner = auth.uid() or public.fn_is_admin())
  );

drop policy if exists "assets_delete_own_or_admin" on storage.objects;
create policy "assets_delete_own_or_admin" on storage.objects
  for delete
  using (
    bucket_id = 'assets'
    and (owner = auth.uid() or public.fn_is_admin())
  );
