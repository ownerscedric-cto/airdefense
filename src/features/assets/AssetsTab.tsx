import { useMemo, useRef, useState } from "react";
import { useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAppStore } from "../../store/useAppStore";
import { useAuth, useIsApproved } from "../../store/AuthProvider";
import type { AssetKind } from "../../lib/assets";
import { migrateLocalToCloud, type AnyAsset } from "../../lib/anyAsset";
import { useAssets, type AddAssetInput } from "./useAssets";

type Filter = "all" | AssetKind;
type SourceFilter = "all" | "local" | "cloud";
type Target = "local" | "cloud";

const KIND_FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "common", label: "공통" },
  { key: "shot", label: "현장" },
];

const SOURCE_FILTERS: Array<{ key: SourceFilter; label: string }> = [
  { key: "all", label: "전부" },
  { key: "cloud", label: "☁ 공유" },
  { key: "local", label: "💾 내 기기" },
];

export function AssetsTab() {
  const { assets, loading, error, add, remove, update, refresh } = useAssets();
  const { currentJob, dispatch } = useAppStore();
  const { role } = useAuth();
  const approved = useIsApproved();
  const { show } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingKind, setPendingKind] = useState<AssetKind>("common");
  const [pendingName, setPendingName] = useState("");
  const [pendingTarget, setPendingTarget] = useState<Target>("cloud");
  const [confirmDelete, setConfirmDelete] = useState<AnyAsset | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const canUploadCloud = approved && (role === "admin" || role === "manager");

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (filter !== "all" && a.kind !== filter) return false;
      if (sourceFilter !== "all" && a.source !== sourceFilter) return false;
      return true;
    });
  }, [assets, filter, sourceFilter]);

  function openPicker() {
    fileInput.current?.click();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      show("이미지 또는 동영상만 등록 가능");
      return;
    }
    setPendingFile(file);
    setPendingName(file.name.replace(/\.[^.]+$/, ""));
    setPendingKind("common");
    setPendingTarget(canUploadCloud ? "cloud" : "local");
  }

  async function commitAdd() {
    if (!pendingFile) return;
    try {
      const payload: AddAssetInput =
        pendingTarget === "cloud"
          ? {
              target: "cloud",
              file: pendingFile,
              name: pendingName,
              kind: pendingKind,
              eventId: pendingKind === "shot" ? undefined : undefined,
            }
          : {
              target: "local",
              file: pendingFile,
              name: pendingName,
              kind: pendingKind,
              jobId: pendingKind === "shot" ? currentJob?.id : undefined,
            };
      await add(payload);
      show("등록됨");
      setPendingFile(null);
      setPendingName("");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "등록 실패";
      show(msg);
    }
  }

  async function commitRename() {
    if (!renaming) return;
    try {
      await update(renaming.id, { name: renaming.value });
      setRenaming(null);
      show("이름 변경됨");
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "이름 변경 실패");
    }
  }

  async function migrateToCloud(asset: AnyAsset) {
    if (asset.source !== "local") return;
    if (!canUploadCloud) {
      show("팀 공유 권한이 없습니다 (관리자/팀장)");
      return;
    }
    try {
      const { oldId, newId } = await migrateLocalToCloud(asset);
      dispatch({ type: "ATTACHMENT_REMAP_ID", oldId, newId });
      await refresh();
      show("팀 공유로 옮김");
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "옮기기 실패");
    }
  }

  async function toggleKind(asset: AnyAsset) {
    const next: AssetKind = asset.kind === "common" ? "shot" : "common";
    try {
      await update(asset.id, {
        kind: next,
        jobId: asset.source === "local" && next === "shot" ? currentJob?.id : null,
      });
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "변경 실패");
    }
  }

  return (
    <div className="space-y-3 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition",
                filter === f.key
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openPicker}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + 추가
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={onPick}
        />
      </header>

      <div className="flex flex-wrap gap-1">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setSourceFilter(f.key)}
            className={[
              "rounded-full px-3 py-1 text-[11px] font-medium transition",
              sourceFilter === f.key
                ? "bg-neutral-700 text-white dark:bg-neutral-300 dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="px-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        이미지·동영상 모두 등록 가능 (최대 100MB). ☁ 공유는 모든 팀원이 함께 사용 / 💾 내 기기는 본인 브라우저만.
      </p>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-neutral-500">불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-neutral-500">
          {filter === "shot" && !currentJob
            ? "작업을 먼저 선택하세요."
            : "등록된 이미지가 없습니다."}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              canMigrate={a.source === "local" && canUploadCloud}
              onRename={() => setRenaming({ id: a.id, value: a.name })}
              onDelete={() => setConfirmDelete(a)}
              onToggleKind={() => toggleKind(a)}
              onMigrate={() => migrateToCloud(a)}
            />
          ))}
        </ul>
      )}

      {/* 등록 다이얼로그 */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPendingFile(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
            <h3 className="mb-3 text-base font-semibold">이미지 등록</h3>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">
                이름
                <input
                  type="text"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  placeholder="예: 장비 사진, 측정기 설명"
                />
              </label>
              <fieldset>
                <legend className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  종류
                </legend>
                <div className="mt-1 flex gap-2">
                  {(["common", "shot"] as AssetKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPendingKind(k)}
                      className={[
                        "flex-1 rounded-lg border px-3 py-2 text-sm transition",
                        pendingKind === k
                          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                          : "border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200",
                      ].join(" ")}
                    >
                      {k === "common" ? "공통" : "현장"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  저장 위치
                </legend>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={!canUploadCloud}
                    onClick={() => setPendingTarget("cloud")}
                    className={[
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition",
                      pendingTarget === "cloud"
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200",
                      !canUploadCloud ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    ☁ 팀 공유
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingTarget("local")}
                    className={[
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition",
                      pendingTarget === "local"
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200",
                    ].join(" ")}
                  >
                    💾 내 기기만
                  </button>
                </div>
                {!canUploadCloud && (
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    팀 공유는 관리자/팀장만 업로드 가능.
                  </p>
                )}
              </fieldset>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                취소
              </button>
              <button
                type="button"
                disabled={pendingKind === "shot" && pendingTarget === "local" && !currentJob}
                onClick={commitAdd}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이름 변경 다이얼로그 */}
      {renaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setRenaming(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
            <h3 className="mb-3 text-base font-semibold">이름 변경</h3>
            <input
              type="text"
              value={renaming.value}
              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={commitRename}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="이미지 삭제"
        message={`"${confirmDelete?.name}" 을(를) 삭제할까요?${
          confirmDelete?.source === "cloud" ? "\n공유 이미지는 모든 팀원에게서 사라집니다." : ""
        }`}
        confirmLabel="삭제"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            try {
              await remove(confirmDelete.id);
              show("삭제됨");
            } catch (err) {
              show(err instanceof Error ? err.message : "삭제 실패");
            }
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

interface CardProps {
  asset: AnyAsset;
  canMigrate: boolean;
  onRename: () => void;
  onDelete: () => void;
  onToggleKind: () => void;
  onMigrate: () => void;
}

function AssetCard({ asset, canMigrate, onRename, onDelete, onToggleKind, onMigrate }: CardProps) {
  const [menu, setMenu] = useState(false);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        className="block w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-left dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="relative aspect-square w-full bg-neutral-100 dark:bg-neutral-800">
          {asset.thumbDataUrl ? (
            <img
              src={asset.thumbDataUrl}
              alt={asset.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-neutral-300">
              {asset.isVideo ? "🎬" : "🖼"}
            </div>
          )}
          <span
            className={[
              "absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-semibold",
              asset.source === "cloud"
                ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
            ].join(" ")}
          >
            {asset.source === "cloud" ? "☁ 공유" : "💾 내 기기"}
          </span>
          {asset.isVideo && (
            <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white">
              ▶ 영상
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 p-2">
          <span className="truncate text-xs font-medium">{asset.name}</span>
          <span
            className={[
              "flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
              asset.kind === "common"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
            ].join(" ")}
          >
            {asset.kind === "common" ? "공통" : "현장"}
          </span>
        </div>
      </button>
      {menu && (
        <div
          className="absolute inset-x-2 top-2 z-10 rounded-lg border border-neutral-200 bg-white p-1 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onRename();
              setMenu(false);
            }}
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            이름 변경
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleKind();
              setMenu(false);
            }}
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {asset.kind === "common" ? "현장으로 전환" : "공통으로 전환"}
          </button>
          {canMigrate && (
            <button
              type="button"
              onClick={() => {
                onMigrate();
                setMenu(false);
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950"
            >
              ☁ 팀 공유로 옮기기
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onDelete();
              setMenu(false);
            }}
            className="block w-full rounded px-2 py-1.5 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => setMenu(false)}
            className="block w-full rounded px-2 py-1.5 text-left text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            닫기
          </button>
        </div>
      )}
    </li>
  );
}
