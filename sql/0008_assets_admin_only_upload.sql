-- =====================================================================
-- 0008_assets_admin_only_upload.sql
--
-- 클라우드 자산(Storage 'assets' 버킷 + cloud_assets 테이블) 업로드를
-- admin 만 가능하도록 제한.
--
-- 이전 정책(0006): admin + manager 가 업로드 가능
-- 새 정책(0008): admin 만 업로드 가능
-- 읽기(SELECT) 는 그대로 — approved 사용자(admin/manager/viewer) 전체.
--
-- 이미 0006 을 실행한 환경용 변경 SQL.
-- 신규 환경에서는 갱신된 0006 을 실행하면 같은 결과.
-- =====================================================================

-- ───────── cloud_assets 테이블 ─────────
-- INSERT 정책: admin 만
drop policy if exists cloud_assets_insert on public.cloud_assets;
create policy cloud_assets_insert on public.cloud_assets
  for insert
  with check (
    created_by = auth.uid()
    and public.fn_is_admin()
  );

-- (UPDATE / DELETE 는 0006 의 본인+admin 정책 유지)

-- ───────── storage.objects (assets 버킷) ─────────
-- INSERT 정책: admin 만
drop policy if exists "assets_insert_admin_manager" on storage.objects;
drop policy if exists "assets_insert_admin" on storage.objects;
create policy "assets_insert_admin" on storage.objects
  for insert
  with check (
    bucket_id = 'assets'
    and public.fn_is_admin()
  );

-- (SELECT / UPDATE / DELETE 는 0006 정책 유지)
