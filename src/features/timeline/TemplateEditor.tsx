import { useMemo, useState } from "react";
import { CategoryDot, CategoryTag } from "../../components/CategoryDot";
import { useToast } from "../../components/Toast";
import { useAppStore } from "../../store/useAppStore";
import { displayStageTime } from "../../lib/timeOffset";
import type { TimelineTemplate } from "../../types";
import { StageEditor } from "./StageEditor";
import { TemplateSubstepList } from "./TemplateSubstepList";

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
  // 단계 추가용: 끼워 넣을 위치 (index = 0 → 맨 위 / N → N번 단계 바로 아래 / stages.length → 맨 아래)
  const [insertAt, setInsertAt] = useState<number | null>(null);
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

  function onInsert(index: number, stage: Omit<TplStage, "substeps">) {
    dispatch({
      type: "TEMPLATE_STAGE_INSERT",
      templateId: current.id,
      index,
      stage: { ...stage, substeps: [] },
    });
    setInsertAt(null);
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

  // 새 단계의 기본 offsetMinutes 추정: 이전 단계 값 + 30분, 또는 0
  function defaultOffsetForInsert(index: number): number {
    const prev = current.stages[index - 1];
    if (prev?.offsetMinutes != null) return prev.offsetMinutes + 30;
    return 0;
  }

  function defaultCategoryForInsert(index: number): TplStage["category"] {
    // 인접 단계의 카테고리를 그대로 따라감
    const prev = current.stages[index - 1];
    const next = current.stages[index];
    return prev?.category ?? next?.category ?? "준비";
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
        💡 시각은 <strong>시공 시작(00:00)</strong> 기준 누적 시간으로 입력합니다. 단계 사이의 <strong>+</strong> 버튼으로
        원하는 위치에 바로 끼워 넣을 수 있어요.
      </p>

      <section className="space-y-0">
        {/* 맨 위 + 버튼 / 인라인 에디터 */}
        <InsertSlot
          active={insertAt === 0}
          onOpen={() => {
            setInsertAt(0);
            setEditingIdx(null);
          }}
        >
          {insertAt === 0 && (
            <StageEditor
              timeMode="offset"
              initial={{
                ...EMPTY_STAGE,
                offsetMinutes: defaultOffsetForInsert(0),
                category: defaultCategoryForInsert(0),
                id: `insert-0-${current.id}`,
              }}
              submitLabel="추가"
              onSave={(s) => onInsert(0, s)}
              onCancel={() => setInsertAt(null)}
            />
          )}
        </InsertSlot>

        {current.stages.length === 0 && insertAt !== 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-xs text-neutral-500 dark:border-neutral-700">
            단계가 없습니다. 위의 <strong>+</strong> 버튼으로 첫 단계를 추가하세요.
          </div>
        )}

        {current.stages.map((s, i) => (
          <div key={i}>
            {editingIdx === i ? (
              <StageEditor
                timeMode="offset"
                initial={{
                  id: `edit-${current.id}-${i}`,
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
                templateId={current.id}
                stage={s}
                index={i}
                isFirst={i === 0}
                isLast={i === current.stages.length - 1}
                onEdit={() => {
                  setEditingIdx(i);
                  setInsertAt(null);
                }}
                onDelete={() => onDelete(i)}
                onMoveUp={() => onMove(i, "up")}
                onMoveDown={() => onMove(i, "down")}
              />
            )}

            <InsertSlot
              active={insertAt === i + 1}
              onOpen={() => {
                setInsertAt(i + 1);
                setEditingIdx(null);
              }}
            >
              {insertAt === i + 1 && (
                <StageEditor
                  timeMode="offset"
                  initial={{
                    ...EMPTY_STAGE,
                    offsetMinutes: defaultOffsetForInsert(i + 1),
                    category: defaultCategoryForInsert(i + 1),
                    id: `insert-${i + 1}-${current.id}`,
                  }}
                  submitLabel="추가"
                  onSave={(s) => onInsert(i + 1, s)}
                  onCancel={() => setInsertAt(null)}
                />
              )}
            </InsertSlot>
          </div>
        ))}
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

interface InsertSlotProps {
  active: boolean;
  onOpen: () => void;
  children?: React.ReactNode;
}

function InsertSlot({ active, onOpen, children }: InsertSlotProps) {
  if (active) {
    return <div className="my-2">{children}</div>;
  }
  return (
    <div className="group relative h-3 hover:h-7 transition-[height]">
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-transparent group-hover:bg-neutral-300 dark:group-hover:bg-neutral-700"
      />
      <button
        type="button"
        onClick={onOpen}
        aria-label="이 위치에 단계 추가"
        className="absolute left-1/2 top-1/2 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300 bg-white text-[11px] font-bold text-neutral-500 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-900 hover:text-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-white dark:hover:text-neutral-900"
      >
        +
      </button>
    </div>
  );
}

interface RowProps {
  templateId: string;
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
  templateId,
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
  const subCount = stage.substeps?.length ?? 0;
  // 하위 동선이 이미 있으면 기본 펼침, 없으면 접힘
  const [open, setOpen] = useState(subCount > 0);

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
            {subCount > 0 && (
              <span className="text-[11px] text-neutral-500">하위 {subCount}</span>
            )}
          </div>
          {stage.detail && (
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              {stage.detail}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        {open ? "▾ 하위 동선 닫기" : `▸ 하위 동선 보기/추가${subCount > 0 ? ` (${subCount})` : ""}`}
      </button>

      {open && (
        <TemplateSubstepList
          templateId={templateId}
          stageIndex={index}
          substeps={stage.substeps ?? []}
        />
      )}

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
