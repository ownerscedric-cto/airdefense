import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/Toast";
import { useAppStore } from "../../store/useAppStore";
import type { TemplateMode, TimelineTemplate } from "../../types";
import { TemplateEditor } from "./TemplateEditor";

type FilterMode = "all" | TemplateMode;

const FILTERS: Array<{ key: FilterMode; label: string }> = [
  { key: "all", label: "전체" },
  { key: "client", label: "💬 고객용" },
  { key: "site", label: "🛠 현장용" },
];

export function TemplatesTab() {
  const { state, dispatch } = useAppStore();
  const { show } = useToast();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [editing, setEditing] = useState<TimelineTemplate | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createMode, setCreateMode] = useState<TemplateMode>("site");

  const [dupSource, setDupSource] = useState<TimelineTemplate | null>(null);
  const [dupName, setDupName] = useState("");

  // 빌트인 편집 시: "복제 직전 스냅샷" + "출처 빌트인 id" 를 저장해두고,
  // 다음 렌더에서 templates 가 늘어나면 추가된 사본을 자동으로 편집기에 열어준다.
  const [pendingEditAfterDuplicate, setPendingEditAfterDuplicate] = useState<{
    baseIds: Set<string>;
    src: string;
  } | null>(null);

  useEffect(() => {
    if (!pendingEditAfterDuplicate) return;
    const added = state.templates.find(
      (t) => !pendingEditAfterDuplicate.baseIds.has(t.id)
    );
    if (added) {
      setEditing(added);
      setPendingEditAfterDuplicate(null);
    }
  }, [state.templates, pendingEditAfterDuplicate]);

  const filtered = useMemo(() => {
    const list = state.templates.slice().sort((a, b) => a.createdAt - b.createdAt);
    if (filter === "all") return list;
    return list.filter((t) => t.mode === filter);
  }, [state.templates, filter]);

  function onCreate() {
    const n = createName.trim();
    if (!n) {
      show("이름을 입력하세요");
      return;
    }
    dispatch({ type: "TEMPLATE_CREATE", name: n, mode: createMode });
    setCreateOpen(false);
    setCreateName("");
    show("템플릿 생성됨");
  }

  function onDuplicate() {
    if (!dupSource) return;
    const n = dupName.trim() || `${dupSource.name} (복제)`;
    dispatch({
      type: "TEMPLATE_DUPLICATE",
      sourceId: dupSource.id,
      newName: n,
    });
    setDupSource(null);
    setDupName("");
    show("복제됨");
  }

  // 빌트인 편집: 복제 액션을 디스패치하면서 "이 시점 이후 새로 생기는 사본을 편집기로 열어라" 신호를 남김.
  // useEffect 가 templates 변화를 감지해서 자동 진입.
  function onEditBuiltin(src: TimelineTemplate) {
    const n = `${src.name} (사본)`;
    setPendingEditAfterDuplicate({ baseIds: new Set(state.templates.map((t) => t.id)), src: src.id });
    dispatch({ type: "TEMPLATE_DUPLICATE", sourceId: src.id, newName: n });
    show("사본이 만들어졌어요");
  }

  function onDelete(t: TimelineTemplate) {
    if (!window.confirm(`"${t.name}" 템플릿을 삭제할까요?`)) return;
    dispatch({ type: "TEMPLATE_DELETE", id: t.id });
    if (editing?.id === t.id) setEditing(null);
    show("삭제됨");
  }

  if (editing) {
    return <TemplateEditor template={editing} onClose={() => setEditing(null)} />;
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
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + 새 템플릿
        </button>
      </header>

      <p className="px-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        🏷 기본 템플릿의 "편집" 을 누르면 자동으로 사본을 만들어 편집 화면으로 들어갑니다. 원본은 보존돼요.
      </p>

      <ul className="space-y-2">
        {filtered.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{t.name}</h3>
                  {t.builtin && (
                    <span className="flex-shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      기본
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {t.mode === "client" ? "💬 고객용" : "🛠 현장용"} · {t.stages.length}단계
                </p>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => (t.builtin ? onEditBuiltin(t) : setEditing(t))}
                  className="rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
                  title={t.builtin ? "사본을 만들어서 편집합니다" : "편집"}
                >
                  {t.builtin ? "편집(사본)" : "편집"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDupSource(t);
                    setDupName(`${t.name} (복제)`);
                  }}
                  className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium dark:border-neutral-700"
                >
                  복제
                </button>
                {!t.builtin && (
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:border-red-900 dark:text-red-300"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-xs text-neutral-500 dark:border-neutral-700">
            조건에 맞는 템플릿이 없습니다.
          </li>
        )}
      </ul>

      {createOpen && (
        <Modal title="새 템플릿" onClose={() => setCreateOpen(false)}>
          <label className="block">
            <span className="text-xs text-neutral-500">이름</span>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="예: 24평 표준 동선"
              autoFocus
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>
          <fieldset className="mt-3">
            <legend className="text-xs text-neutral-500">종류</legend>
            <div className="mt-1 flex gap-2">
              {(["site", "client"] as TemplateMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCreateMode(m)}
                  className={[
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition",
                    createMode === m
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                      : "border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200",
                  ].join(" ")}
                >
                  {m === "site" ? "🛠 현장용" : "💬 고객용"}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              생성
            </button>
          </div>
        </Modal>
      )}

      {dupSource && (
        <Modal title="템플릿 복제" onClose={() => setDupSource(null)}>
          <p className="text-xs text-neutral-500">
            원본: <strong>{dupSource.name}</strong> ({dupSource.stages.length}단계)
          </p>
          <label className="mt-3 block">
            <span className="text-xs text-neutral-500">사본 이름</span>
            <input
              type="text"
              value={dupName}
              onChange={(e) => setDupName(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDupSource(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              복제
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
        <h3 className="mb-3 text-base font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}
