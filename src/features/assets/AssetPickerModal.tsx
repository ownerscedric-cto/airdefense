import { useMemo, useRef, useState } from "react";
import { useToast } from "../../components/Toast";
import { useAppStore } from "../../store/useAppStore";
import { useAuth } from "../../store/AuthProvider";
import type { AssetKind } from "../../lib/assets";
import type { AnyAsset } from "../../lib/anyAsset";
import { useAssets, type AddAssetInput } from "./useAssets";

type Filter = "all" | AssetKind;
type Target = "local" | "cloud";

interface Props {
  open: boolean;
  excludeIds?: string[];
  onClose: () => void;
  onPick: (asset: AnyAsset) => void;
}

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "common", label: "공통" },
  { key: "shot", label: "현장" },
];

export function AssetPickerModal({ open, excludeIds = [], onClose, onPick }: Props) {
  const { assets, loading, error, add } = useAssets();
  const { currentJob } = useAppStore();
  const { role } = useAuth();
  const { show } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingKind, setPendingKind] = useState<AssetKind>("common");
  const [pendingName, setPendingName] = useState("");
  const [pendingTarget, setPendingTarget] = useState<Target>("cloud");

  const canUploadCloud = role === "admin" || role === "manager";

  const filtered = useMemo(() => {
    const ex = new Set(excludeIds);
    return assets
      .filter((a) => !ex.has(a.id))
      .filter((a) => (filter === "all" ? true : a.kind === filter));
  }, [assets, excludeIds, filter]);

  if (!open) return null;

  function openPicker() {
    fileInput.current?.click();
  }

  function onPick2(e: React.ChangeEvent<HTMLInputElement>) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-neutral-900 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h3 className="text-base font-semibold">이미지 첨부</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </header>

        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
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
            + 새 이미지
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick2}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && (
            <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              ⚠ {error}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-sm text-neutral-500">불러오는 중…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-500">
              {assets.length === 0
                ? '등록된 이미지가 없습니다. "+ 새 이미지"로 추가하세요.'
                : "선택 가능한 이미지가 없습니다."}
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {filtered.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(a);
                      onClose();
                    }}
                    className="block w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-left dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="relative aspect-square w-full bg-neutral-100 dark:bg-neutral-800">
                      {a.thumbDataUrl ? (
                        <img
                          src={a.thumbDataUrl}
                          alt={a.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-300">
                          🖼
                        </div>
                      )}
                      <span
                        className={[
                          "absolute left-0.5 top-0.5 rounded px-1 py-0.5 text-[9px] font-semibold",
                          a.source === "cloud"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                            : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
                        ].join(" ")}
                      >
                        {a.source === "cloud" ? "☁" : "💾"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 p-1.5">
                      <span className="truncate text-[11px] font-medium">{a.name}</span>
                      <span
                        className={[
                          "flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold",
                          a.kind === "common"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                        ].join(" ")}
                      >
                        {a.kind === "common" ? "공통" : "현장"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 새 이미지 등록 다이얼로그 */}
        {pendingFile && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
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
      </div>
    </div>
  );
}
