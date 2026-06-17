// 통합 자산 모델 — 로컬(IndexedDB) + 클라우드(Supabase) 자산을 같은 인터페이스로 다룬다.
//
// id 접두사로 출처를 구분:
//   - 로컬:   "local:<localId>"
//   - 클라우드: "cloud:<uuid>"
// 기존 메시지 첨부(messageAttachments) 에는 이 접두사 형태로 저장한다.
// 마이그레이션: 접두사 없는 ID 는 로컬(기존 데이터)로 간주.

import {
  assetToFile as localAssetToFile,
  deleteAsset as localDelete,
  getAsset as localGet,
  listAssets as localList,
  updateAssetMeta as localUpdate,
  type Asset as LocalAsset,
  type AssetKind,
} from "./assets";
import {
  deleteCloudAsset,
  downloadCloudAssetAsFile,
  getCloudAsset,
  getCloudAssetsByIds,
  listCloudAssets,
  updateCloudAsset,
  type CloudAssetRow,
} from "./db/cloudAssets";

export type AssetSource = "local" | "cloud";

export interface AnyAsset {
  source: AssetSource;
  id: string;             // "local:<id>" / "cloud:<uuid>"
  rawId: string;          // 접두사 없는 원본 id
  kind: AssetKind;
  name: string;
  tags: string[];
  thumbDataUrl: string;
  jobId?: string | null;      // local 전용
  eventId?: string | null;    // cloud 전용
  createdAt: number;
  // 출처별 원본 객체 보관 (파일 추출 시 사용)
  _local?: LocalAsset;
  _cloud?: CloudAssetRow;
}

// ───── ID 헬퍼 ─────
export function encodeLocalId(id: string): string {
  return `local:${id}`;
}

export function encodeCloudId(id: string): string {
  return `cloud:${id}`;
}

export function parseAssetId(id: string): { source: AssetSource; rawId: string } {
  if (id.startsWith("cloud:")) return { source: "cloud", rawId: id.slice(6) };
  if (id.startsWith("local:")) return { source: "local", rawId: id.slice(6) };
  // 접두사 없는 기존 데이터는 로컬로 간주 (마이그레이션 호환)
  return { source: "local", rawId: id };
}

// ───── 변환 ─────
function fromLocal(l: LocalAsset): AnyAsset {
  return {
    source: "local",
    id: encodeLocalId(l.id),
    rawId: l.id,
    kind: l.kind,
    name: l.name,
    tags: l.tags,
    thumbDataUrl: l.thumbDataUrl,
    jobId: l.jobId ?? null,
    createdAt: l.createdAt,
    _local: l,
  };
}

function fromCloud(c: CloudAssetRow): AnyAsset {
  return {
    source: "cloud",
    id: encodeCloudId(c.id),
    rawId: c.id,
    kind: c.kind,
    name: c.name,
    tags: c.tags,
    thumbDataUrl: c.thumb_data_url ?? "",
    eventId: c.event_id,
    createdAt: new Date(c.created_at).getTime(),
    _cloud: c,
  };
}

// ───── 조회 ─────
export async function listAllAssets(): Promise<AnyAsset[]> {
  const [local, cloud] = await Promise.allSettled([listLocal(), listCloud()]);
  const list: AnyAsset[] = [];
  if (local.status === "fulfilled") list.push(...local.value);
  else console.error("[anyAsset.listAllAssets] local failed", local.reason);
  if (cloud.status === "fulfilled") list.push(...cloud.value);
  else console.error("[anyAsset.listAllAssets] cloud failed", cloud.reason);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

async function listLocal(): Promise<AnyAsset[]> {
  const list = await localList();
  return list.map(fromLocal);
}

async function listCloud(): Promise<AnyAsset[]> {
  try {
    const list = await listCloudAssets();
    return list.map(fromCloud);
  } catch (err) {
    // 로그인 안 됐거나 RLS 에서 막힌 경우 — 클라우드 자산 빈 배열로
    console.warn("[anyAsset.listCloud] skipped", err);
    return [];
  }
}

export async function getAnyAssetById(encodedId: string): Promise<AnyAsset | null> {
  const { source, rawId } = parseAssetId(encodedId);
  if (source === "local") {
    const a = await localGet(rawId);
    return a ? fromLocal(a) : null;
  }
  const c = await getCloudAsset(rawId);
  return c ? fromCloud(c) : null;
}

export async function getAnyAssetsByIds(encodedIds: string[]): Promise<AnyAsset[]> {
  const localRaws: string[] = [];
  const cloudRaws: string[] = [];
  for (const id of encodedIds) {
    const { source, rawId } = parseAssetId(id);
    if (source === "local") localRaws.push(rawId);
    else cloudRaws.push(rawId);
  }
  const [locals, clouds] = await Promise.all([
    Promise.all(localRaws.map((id) => localGet(id))).then((arr) =>
      arr.filter((a): a is LocalAsset => !!a).map(fromLocal)
    ),
    cloudRaws.length > 0
      ? getCloudAssetsByIds(cloudRaws).then((arr) => arr.map(fromCloud)).catch((err) => {
          console.warn("[anyAsset.getAnyAssetsByIds] cloud failed", err);
          return [] as AnyAsset[];
        })
      : Promise.resolve([] as AnyAsset[]),
  ]);
  // 입력 순서대로 정렬해서 반환
  const map = new Map<string, AnyAsset>();
  for (const a of [...locals, ...clouds]) map.set(a.id, a);
  return encodedIds.map((id) => map.get(id)).filter((a): a is AnyAsset => !!a);
}

// ───── 수정 ─────
export async function updateAnyAssetMeta(
  encodedId: string,
  patch: { name?: string; tags?: string[]; kind?: AssetKind; jobId?: string | null; eventId?: string | null }
): Promise<AnyAsset | null> {
  const { source, rawId } = parseAssetId(encodedId);
  if (source === "local") {
    const updated = await localUpdate(rawId, {
      name: patch.name,
      tags: patch.tags,
      kind: patch.kind,
      jobId: patch.jobId ?? undefined,
    });
    return updated ? fromLocal(updated) : null;
  }
  const updated = await updateCloudAsset(rawId, {
    name: patch.name,
    tags: patch.tags,
    kind: patch.kind,
    event_id: patch.eventId,
  });
  return fromCloud(updated);
}

// ───── 삭제 ─────
export async function deleteAnyAsset(encodedId: string): Promise<void> {
  const { source, rawId } = parseAssetId(encodedId);
  if (source === "local") {
    await localDelete(rawId);
  } else {
    await deleteCloudAsset(rawId);
  }
}

// ───── 공유용 File 추출 ─────
export async function anyAssetToFile(asset: AnyAsset): Promise<File> {
  if (asset.source === "local" && asset._local) {
    return localAssetToFile(asset._local);
  }
  if (asset.source === "cloud" && asset._cloud) {
    return downloadCloudAssetAsFile(asset._cloud);
  }
  throw new Error("자산 원본 객체가 없습니다");
}

// ───── 마이그레이션: 로컬 자산 → 클라우드 ─────
import { uploadCloudAsset } from "./db/cloudAssets";

export async function migrateLocalToCloud(asset: AnyAsset): Promise<{
  oldId: string;
  newId: string;
}> {
  if (asset.source !== "local" || !asset._local) {
    throw new Error("로컬 자산만 클라우드로 옮길 수 있습니다");
  }
  const local = asset._local;
  const file = await localAssetToFile(local);
  const cloud = await uploadCloudAsset({
    file,
    name: local.name,
    kind: local.kind,
    tags: local.tags,
  });
  // 클라우드 업로드 성공 후 로컬 삭제
  await localDelete(local.id);
  return { oldId: encodeLocalId(local.id), newId: encodeCloudId(cloud.id) };
}
