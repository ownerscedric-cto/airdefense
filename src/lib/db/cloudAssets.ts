import { supabase } from "../supabase";
import { makeThumbnail } from "../assets";

// ===== 타입 =====
export type CloudAssetKind = "common" | "shot";

export interface CloudAssetRow {
  id: string;
  kind: CloudAssetKind;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  thumb_data_url: string | null;
  tags: string[];
  event_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const BUCKET = "assets";
const SIGNED_URL_TTL_SEC = 60 * 60; // 1시간

// ===== 조회 =====
export async function listCloudAssets(): Promise<CloudAssetRow[]> {
  const { data, error } = await supabase
    .from("cloud_assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudAssetRow[];
}

export async function getCloudAsset(id: string): Promise<CloudAssetRow | null> {
  const { data, error } = await supabase
    .from("cloud_assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as CloudAssetRow | null;
}

export async function getCloudAssetsByIds(ids: string[]): Promise<CloudAssetRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("cloud_assets")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as CloudAssetRow[];
}

// ===== 업로드 =====
export interface UploadCloudAssetInput {
  file: File;
  name: string;
  kind: CloudAssetKind;
  tags?: string[];
  eventId?: string | null;
}

export async function uploadCloudAsset(input: UploadCloudAssetInput): Promise<CloudAssetRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("로그인이 필요합니다");

  // 1) 썸네일 생성
  const thumb = await makeThumbnail(input.file);

  // 2) Storage 업로드
  const nameExt = (input.file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const isVideo = (input.file.type || "").startsWith("video/");
  const ext = nameExt || (isVideo ? "mp4" : "jpg");
  const storagePath = `${input.kind}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
    contentType: input.file.type || "image/jpeg",
    upsert: false,
  });
  if (upErr) throw new Error(`업로드 실패: ${upErr.message}`);

  // 3) 메타데이터 INSERT
  const dims = isVideo
    ? await readVideoDimensions(input.file).catch(() => ({ width: null, height: null }))
    : await readImageDimensions(input.file).catch(() => ({ width: null, height: null }));
  const row = {
    kind: input.kind,
    name: input.name.trim() || "이름 없음",
    storage_path: storagePath,
    mime_type: input.file.type || null,
    size_bytes: input.file.size,
    width: dims.width,
    height: dims.height,
    thumb_data_url: thumb,
    tags: input.tags ?? [],
    event_id: input.kind === "shot" ? input.eventId ?? null : null,
    created_by: auth.user.id,
  };
  const { data, error } = await supabase
    .from("cloud_assets")
    .insert(row as never)
    .select()
    .single();
  if (error) {
    // 실패하면 업로드한 파일 정리
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
    throw error;
  }
  return data as CloudAssetRow;
}

// ===== 수정 =====
export async function updateCloudAsset(
  id: string,
  patch: Partial<Pick<CloudAssetRow, "name" | "tags" | "kind" | "event_id">>
): Promise<CloudAssetRow> {
  const final: Record<string, unknown> = { ...patch };
  if (patch.name != null) final.name = String(patch.name).trim() || "이름 없음";
  if (patch.kind === "common") final.event_id = null;
  const { data, error } = await supabase
    .from("cloud_assets")
    .update(final as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CloudAssetRow;
}

// ===== 삭제 =====
export async function deleteCloudAsset(id: string): Promise<void> {
  const row = await getCloudAsset(id);
  if (!row) return;
  // Storage 파일 먼저 제거 (실패해도 메타데이터는 삭제)
  await supabase.storage.from(BUCKET).remove([row.storage_path]).catch((err) => {
    console.warn("[cloudAssets.deleteCloudAsset] storage remove failed", err);
  });
  const { error } = await supabase.from("cloud_assets").delete().eq("id", id);
  if (error) throw error;
}

// ===== Signed URL / 다운로드 =====
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadCloudAssetAsFile(row: CloudAssetRow): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET).download(row.storage_path);
  if (error) throw error;
  const mime = row.mime_type || guessMimeFromPath(row.storage_path) || "image/jpeg";
  const isVideo = mime.startsWith("video/");
  const ext = mime.split("/")[1] || (isVideo ? "mp4" : "jpg");
  const safeName = (row.name || (isVideo ? "video" : "image")).replace(/[\\/:*?"<>|]/g, "_");
  return new File([data], `${safeName}.${ext}`, { type: mime });
}

function guessMimeFromPath(path: string): string | null {
  const ext = (path.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  };
  return map[ext] ?? null;
}

// ===== 헬퍼 =====
function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 디코딩 실패"));
    };
    img.src = url;
  });
}

function readVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const w = v.videoWidth;
      const h = v.videoHeight;
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("동영상 메타데이터 로드 실패"));
    };
    v.src = url;
  });
}
