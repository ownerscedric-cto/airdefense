import { useState } from "react";
import { CategoryDot, CategoryTag } from "../../components/CategoryDot";
import { useAppStore } from "../../store/useAppStore";
import { displayStageTime } from "../../lib/timeOffset";
import type { Stage, TemplateMode } from "../../types";
import { StageEditor } from "./StageEditor";
import { SubstepList } from "./SubstepList";

interface Props {
  jobId: string;
  mode: TemplateMode;
  stage: Stage;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
}

export function StageItem({
  jobId,
  mode,
  stage,
  isCurrent,
  isFirst,
  isLast,
}: Props) {
  const { dispatch } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [showSubsteps, setShowSubsteps] = useState(
    mode === "site" || stage.substeps.length > 0
  );

  const subDone = stage.substeps.filter((s) => s.done).length;
  const subTotal = stage.substeps.length;

  if (editing) {
    return (
      <div className="relative pl-6">
        <Spine />
        <StageEditor
          initial={stage}
          onSave={(patch) => {
            dispatch({
              type: "STAGE_UPDATE",
              jobId,
              mode,
              stageId: stage.id,
              patch,
            });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <Spine />
      <div
        className={[
          "absolute left-[6px] top-3 inline-flex h-3 w-3 -translate-x-1/2 items-center justify-center rounded-full ring-2",
          stage.done
            ? "bg-neutral-400 ring-neutral-100 dark:bg-neutral-600 dark:ring-neutral-950"
            : isCurrent
            ? "bg-neutral-900 ring-neutral-100 dark:bg-white dark:ring-neutral-950"
            : "bg-white ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700",
        ].join(" ")}
        aria-hidden
      >
        {stage.done && (
          <svg viewBox="0 0 8 8" className="h-2 w-2 text-white dark:text-neutral-900" aria-hidden>
            <path d="M1.5 4.2 3.3 6 6.5 2.4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div
        className={[
          "rounded-xl border p-3 transition-colors",
          isCurrent && !stage.done
            ? "border-neutral-900 bg-white shadow-sm dark:border-white dark:bg-neutral-900"
            : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
          stage.done ? "opacity-60" : "",
        ].join(" ")}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "STAGE_TOGGLE_DONE",
                jobId,
                mode,
                stageId: stage.id,
              })
            }
            className={[
              "mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border",
              stage.done
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-300 dark:border-neutral-600",
            ].join(" ")}
            aria-pressed={stage.done}
            aria-label={stage.done ? "완료 해제" : "완료 표시"}
          >
            {stage.done && (
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                <path d="M2.5 6.2 4.8 8.5 9.5 3.8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {(() => {
                const t = displayStageTime(stage);
                return t ? (
                  <span className="font-mono text-sm font-semibold tabular-nums">{t}</span>
                ) : null;
              })()}
              <CategoryDot category={stage.category} />
              <span
                className={[
                  "min-w-0 truncate text-sm font-semibold",
                  stage.done ? "line-through" : "",
                  isCurrent && !stage.done ? "text-neutral-900 dark:text-white" : "",
                ].join(" ")}
              >
                {stage.title}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <CategoryTag category={stage.category} />
              {isCurrent && !stage.done && (
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-white dark:text-neutral-900">
                  현재 단계
                </span>
              )}
              {subTotal > 0 && (
                <span className="text-[11px] text-neutral-500 tabular-nums">
                  하위 {subDone}/{subTotal}
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

        {(subTotal > 0 || mode === "site") && (
          <button
            type="button"
            onClick={() => setShowSubsteps((s) => !s)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {showSubsteps ? "▾ 하위 동선 닫기" : "▸ 하위 동선 보기/추가"}
          </button>
        )}

        {showSubsteps && (subTotal > 0 || mode === "site") && (
          <SubstepList jobId={jobId} mode={mode} stage={stage} />
        )}

        <div className="mt-2 flex items-center justify-end gap-1">
          <IconBtn
            label="위로"
            disabled={isFirst}
            onClick={() =>
              dispatch({ type: "STAGE_MOVE", jobId, mode, stageId: stage.id, dir: "up" })
            }
          >
            ▲
          </IconBtn>
          <IconBtn
            label="아래로"
            disabled={isLast}
            onClick={() =>
              dispatch({ type: "STAGE_MOVE", jobId, mode, stageId: stage.id, dir: "down" })
            }
          >
            ▼
          </IconBtn>
          <IconBtn label="편집" onClick={() => setEditing(true)}>
            ✏️
          </IconBtn>
          <IconBtn
            label="삭제"
            danger
            onClick={() => {
              if (window.confirm(`"${stage.title}" 단계를 삭제할까요?`)) {
                dispatch({ type: "STAGE_DELETE", jobId, mode, stageId: stage.id });
              }
            }}
          >
            🗑
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

function Spine() {
  return (
    <span
      aria-hidden
      className="absolute left-[6px] top-0 h-full w-px -translate-x-1/2 bg-neutral-200 dark:bg-neutral-800"
    />
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
