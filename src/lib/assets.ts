import { idbAll, idbDelete, idbGet, idbPut } from "./idb";
import { uid } from "./id";

export type AssetKind = "common" | "shot";

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  tags: string[];
  blob: Blob;
  thumbDataUrl: string;
  jobId?: string;
  createdAt: number;
}

const THUMB_MAX_WIDTH = 320;
const THUMB_QUALITY = 0.72;

export async function makeThumbnail(file: Blob): Promise<string> {
  // 동영상이면 첫 프레임을 캡처
  if ((file.type || "").startsWith("video/")) {
    return makeVideoThumbnail(file);
  }
  // iOS Safari의 HEIC 등은 createImageBitmap이 실패하므로 HTMLImageElement 경로를 우선 사용
  const img = await loadHTMLImage(file);
  const srcW = img.naturalWidth || 1;
  const srcH = img.naturalHeight || 1;
  const ratio = Math.min(1, THUMB_MAX_WIDTH / srcW);
  const w = Math.max(1, Math.round(srcW * ratio));
  const h = Math.max(1, Math.round(srcH * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D 컨텍스트를 사용할 수 없음");
  ctx.drawImage(img, 0, 0, w, h);
  if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
}

/** 동영상의 첫 프레임(0.1s 시점)을 캡처해서 JPEG dataURL 로. */
async function makeVideoThumbnail(file: Blob): Promise<string> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("동영상 메타데이터 로드 실패"));
      };
      const cleanup = () => {
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("error", onError);
      };
      video.addEventListener("loadeddata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });

    // 0.1s 지점으로 seek (시작 프레임이 검은 경우 회피)
    await new Promise<void>((resolve) => {
      const onSeeked = () => resolve();
      video.addEventListener("seeked", onSeeked, { once: true });
      try {
        video.currentTime = Math.min(0.1, video.duration || 0);
      } catch {
        resolve();
      }
    });

    const srcW = video.videoWidth || 1;
    const srcH = video.videoHeight || 1;
    const ratio = Math.min(1, THUMB_MAX_WIDTH / srcW);
    const w = Math.max(1, Math.round(srcW * ratio));
    const h = Math.max(1, Math.round(srcH * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 컨텍스트 없음");
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadHTMLImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 디코딩 실패 (HEIC 등 지원 안 되는 형식일 수 있음)"));
    };
    img.src = url;
  });
}

export interface CreateAssetInput {
  kind: AssetKind;
  name: string;
  tags?: string[];
  file: Blob;
  jobId?: string;
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const thumbDataUrl = await makeThumbnail(input.file);
  const asset: Asset = {
    id: uid("ast"),
    kind: input.kind,
    name: input.name.trim() || "이름 없음",
    tags: input.tags ?? [],
    blob: input.file,
    thumbDataUrl,
    jobId: input.kind === "shot" ? input.jobId : undefined,
    createdAt: Date.now(),
  };
  await idbPut(asset);
  return asset;
}

export async function listAssets(): Promise<Asset[]> {
  const all = await idbAll<Asset>();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  return idbGet<Asset>(id);
}

export async function getAssetsByIds(ids: string[]): Promise<Asset[]> {
  const results = await Promise.all(ids.map((id) => idbGet<Asset>(id)));
  return results.filter((a): a is Asset => !!a);
}

export async function deleteAsset(id: string): Promise<void> {
  return idbDelete(id);
}

export async function updateAssetMeta(
  id: string,
  patch: Partial<Pick<Asset, "name" | "tags" | "kind" | "jobId">>
): Promise<Asset | undefined> {
  const cur = await getAsset(id);
  if (!cur) return undefined;
  const next: Asset = {
    ...cur,
    ...patch,
    name: patch.name?.trim() || cur.name,
  };
  if (next.kind !== "shot") next.jobId = undefined;
  await idbPut(next);
  return next;
}

const SHAREABLE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const NAME_SANITIZE_RE = /[\\/:*?"<>|]/g;

export async function assetToFile(asset: Asset): Promise<File> {
  const safeName = asset.name.replace(NAME_SANITIZE_RE, "_") || "asset";
  const rawMime = asset.blob.type || "";
  const isVideo = rawMime.startsWith("video/");

  // 공유 가능한 표준 MIME(이미지/영상) 이면 그대로
  if (SHAREABLE_MIME.has(rawMime)) {
    const ext = rawMime.split("/")[1] || (isVideo ? "mp4" : "jpg");
    return new File([asset.blob], `${safeName}.${ext}`, { type: rawMime });
  }

  // 영상이지만 비표준 MIME 이면 그대로 (Canvas 재인코딩 불가)
  if (isVideo) {
    const ext = rawMime.split("/")[1] || "mp4";
    return new File([asset.blob], `${safeName}.${ext}`, { type: rawMime || "video/mp4" });
  }

  // HEIC/HEIF/빈 MIME 이미지는 JPEG 로 재인코딩 시도
  try {
    const jpegBlob = await reencodeAsJpeg(asset.blob);
    return new File([jpegBlob], `${safeName}.jpg`, { type: "image/jpeg" });
  } catch (err) {
    console.warn("[assetToFile] re-encode failed, falling back to raw blob", err);
    const fallbackMime = rawMime || "image/jpeg";
    const ext = fallbackMime.split("/")[1] || "jpg";
    return new File([asset.blob], `${safeName}.${ext}`, { type: fallbackMime });
  }
}

async function reencodeAsJpeg(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("이미지 디코딩 실패"));
      i.src = url;
    });
    const w = img.naturalWidth || 1;
    const h = img.naturalHeight || 1;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 컨텍스트 없음");
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Blob 변환 실패"))),
        "image/jpeg",
        0.92
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
