import { useMemo, useState } from "react";
import { CategoryDot, CategoryTag } from "../../components/CategoryDot";
import { useToast } from "../../components/Toast";
import { useAppStore } from "../../store/useAppStore";
import { displayStageTime } from "../../lib/timeOffset";
import type { TimelineTemplate } from "../../types";
import { StageEditor } from "./StageEditor";

interface Props {
  template: TimelineTemplate;
  onClose: () => void;
}

type TplStage = TimelineTemplate["stages"][number];

const EMPTY_STAGE: TplStage = {
  time: "",
  offsetMinutes: 0,
  category: "준비",
  title: "",
  detail: "",
  substeps: [],
};

export function TemplateEditor({ template, onClose }: Props) {
  const { state, dispatch } = useAppStore();
  const { show } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(template.name);

  // 가장 최신 템플릿 상태 반영
  const current = useMemo(
    () => state.templates.find((t) => t.id === template.id) ?? template,
    [state.templates, template]
  );

  if (current.builtin) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        ⚠ 기본(빌트인) 템플릿은 직접 수정할 수 없습니다. "복제"한 사본을 편집하세요.
        <div className="mt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  function onAdd(stage: Omit<TplStage, "substeps">) {
    dispatch({
      type: "TEMPLATE_STAGE_ADD",
      templateId: current.id,
      stage: { ...stage, substeps: [] },
    });
    setAdding(false);
    show("단계 추가됨");
  }

  function onUpdate(index: number, patch: Partial<TplStage>) {
    dispatch({
      type: "TEMPLATE_STAGE_UPDATE",
      templateId: current.id,
      index,
      patch,
    });
    setEditingIdx(null);
    show("단계 수정됨");
  }

  function onDelete(index: number) {
    if (!window.confirm("이 단계를 삭제할까요?")) return;
    dispatch({ type: "TEMPLATE_STAGE_DELETE", templateId: current.id, index });
    show("단계 삭제됨");
  }

  function onMove(index: number, dir: "up" | "down") {
    dispatch({ type: "TEMPLATE_STAGE_MOVE", templateId: current.id, index, dir });
  }

  function commitRename() {
    const t = newName.trim();
    if (!t) {
      show("이름을 입력하세요");
      return;
    }
    dispatch({ type: "TEMPLATE_RENAME", id: current.id, name: t });
    setRenameOpen(false);
    show("이름 변경됨");
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{current.name}</h2>
          <p className="text-[11px] text-neutral-500">
            {current.mode === "client" ? "💬 고객용" : "🛠 현장용"} · {current.stages.length}단계
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setNewName(current.name);
              setRenameOpen(true);
            }}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-medium dark:border-neutral-700"
          >
            이름 변경
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            닫기
          </button>
        </div>
      </header>

      <p className="rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600 dark:bg-neutral-900/60 dark:text-neutral-300">
        💡 시각은 <strong>시공 시작(00:00)</strong> 기준 누적 시간으로 입력합니다. 작업에 적용 시
        실제 시작 시각과 합쳐서 절대 시각으로 표시됩니다.
      </p>

      <section className="space-y-2">
        {current.stages.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-xs text-neutral-500 dark:border-neutral-700">
            단계가 없습니다. 아래 "+ 단계 추가" 로 시작하세요.
          </div>
        )}
        {current.stages.map((s, i) =>
          editingIdx === i ? (
            <StageEditor
              key={i}
              timeMode="offset"
              initial={{
                id: `${current.id}-${i}`,
                time: s.time,
                offsetMinutes: s.offsetMinutes ?? 0,
                title: s.title,
                category: s.category,
                detail: s.detail,
              }}
              onSave={(patch) => onUpdate(i, patch)}
              onCancel={() => setEditingIdx(null)}
            />
          ) : (
            <TemplateStageRow
              key={i}
              stage={s}
              index={i}
              isFirst={i === 0}
              isLast={i === current.stages.length - 1}
              onEdit={() => setEditingIdx(i)}
              onDelete={() => onDelete(i)}
              onMoveUp={() => onMove(i, "up")}
              onMoveDown={() => onMove(i, "down")}
            />
          )
        )}
      </section>

      <section>
        {adding ? (
          <StageEditor
            timeMode="offset"
            initial={{
              ...EMPTY_STAGE,
              id: `new-${current.id}`,
            }}
            submitLabel="추가"
            onSave={(s) => onAdd(s)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            + 단계 추가
          </button>
        )}
      </section>

      {renameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setRenameOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
            <h3 className="mb-3 text-base font-semibold">템플릿 이름 변경</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
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
    </div>
  );
}

interface RowProps {
  stage: TplStage;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function TemplateStageRow({
  stage,
  index,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: RowProps) {
  const t = displayStageTime(stage);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-2">
        <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold tabular-nums text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {t && (
              <span className="font-mono text-sm font-semibold tabular-nums">{t}</span>
            )}
            <CategoryDot category={stage.category} />
            <span className="min-w-0 truncate text-sm font-semibold">{stage.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CategoryTag category={stage.category} />
            {stage.substeps.length > 0 && (
              <span className="text-[11px] text-neutral-500">
                하위 {stage.substeps.length}
              </span>
            )}
          </div>
          {stage.detail && (
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              {stage.detail}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1">
        <IconBtn label="위로" disabled={isFirst} onClick={onMoveUp}>
          ▲
        </IconBtn>
        <IconBtn label="아래로" disabled={isLast} onClick={onMoveDown}>
          ▼
        </IconBtn>
        <IconBtn label="편집" onClick={onEdit}>
          ✏️
        </IconBtn>
        <IconBtn label="삭제" danger onClick={onDelete}>
          🗑
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm",
        disabled
          ? "opacity-30"
          : danger
          ? "hover:bg-red-50 dark:hover:bg-red-950"
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
