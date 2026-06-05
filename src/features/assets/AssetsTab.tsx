import { useMemo, useRef, useState } from "react";
import { useToast } from "../../components/Toast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAppStore } from "../../store/useAppStore";
import type { Asset, AssetKind } from "../../lib/assets";
import { useAssets } from "./useAssets";

type Filter = "all" | AssetKind;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "common", label: "공통" },
  { key: "shot", label: "현장" },
];

export function AssetsTab() {
  const { assets, loading, error, add, remove, update } = useAssets();
  const { currentJob } = useAppStore();
  const { show } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingKind, setPendingKind] = useState<AssetKind>("common");
  const [pendingName, setPendingName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? assets : assets.filter((a) => a.kind === filter)),
    [assets, filter]
  );

  function openPicker() {
    fileInput.current?.click();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      show("이미지 파일만 등록 가능");
      return;
    }
    setPendingFile(file);
    setPendingName(file.name.replace(/\.[^.]+$/, ""));
    setPendingKind("common");
  }

  async function commitAdd() {
    if (!pendingFile) return;
    try {
      await add({
        kind: pendingKind,
        name: pendingName,
        file: pendingFile,
        jobId: pendingKind === "shot" ? currentJob?.id : undefined,
      });
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
    await update(renaming.id, { name: renaming.value });
    setRenaming(null);
    show("이름 변경됨");
  }

  async function toggleKind(asset: Asset) {
    const next: AssetKind = asset.kind === "common" ? "shot" : "common";
    await update(asset.id, {
      kind: next,
      jobId: next === "shot" ? currentJob?.id ?? asset.jobId : undefined,
    });
  }

  return (
    <div className="space-y-3 pb-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
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
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
      </header>

      <p className="px-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        공통: 매 시공마다 재사용 / 현장: 현재 작업 ({currentJob?.customer || "선택 안 됨"}) 전용. 카드를 길게 누르면 이름을 바꾸거나 삭제할 수 있어요.
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
              onRename={() => setRenaming({ id: a.id, value: a.name })}
              onDelete={() => setConfirmDelete(a)}
              onToggleKind={() => toggleKind(a)}
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
                {pendingKind === "shot" && !currentJob && (
                  <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
                    현장 이미지는 작업을 먼저 선택해야 합니다.
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
                disabled={pendingKind === "shot" && !currentJob}
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
        message={`"${confirmDelete?.name}" 을(를) 삭제할까요?`}
        confirmLabel="삭제"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await remove(confirmDelete.id);
            show("삭제됨");
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

interface CardProps {
  asset: Asset;
  onRename: () => void;
  onDelete: () => void;
  onToggleKind: () => void;
}

function AssetCard({ asset, onRename, onDelete, onToggleKind }: CardProps) {
  const [menu, setMenu] = useState(false);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        className="block w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-left dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="aspect-square w-full bg-neutral-100 dark:bg-neutral-800">
          <img
            src={asset.thumbDataUrl}
            alt={asset.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
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
