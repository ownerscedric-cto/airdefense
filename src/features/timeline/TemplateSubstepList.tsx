import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { TimelineTemplate } from "../../types";

type TplStage = TimelineTemplate["stages"][number];
type TplSubstep = TplStage["substeps"][number];

interface Props {
  templateId: string;
  stageIndex: number;
  substeps: TplSubstep[];
}

export function TemplateSubstepList({ templateId, stageIndex, substeps }: Props) {
  const { dispatch } = useAppStore();
  const [newText, setNewText] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  function add() {
    const t = newText.trim();
    if (!t) return;
    dispatch({ type: "TEMPLATE_SUBSTEP_ADD", templateId, stageIndex, text: t });
    setNewText("");
  }

  return (
    <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-2 dark:border-neutral-800 dark:bg-neutral-950/40">
      <ul className="space-y-1">
        {substeps.map((sub, i) => {
          const isFirst = i === 0;
          const isLast = i === substeps.length - 1;
          const isEditing = editingIdx === i;
          return (
            <li key={i} className="rounded-md bg-white px-2 py-1.5 dark:bg-neutral-900">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded bg-neutral-100 px-1 text-[10px] font-semibold tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={sub.text}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== sub.text) {
                          dispatch({
                            type: "TEMPLATE_SUBSTEP_UPDATE",
                            templateId,
                            stageIndex,
                            subIndex: i,
                            patch: { text: v },
                          });
                        }
                        setEditingIdx(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingIdx(null);
                      }}
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingIdx(i)}
                      className="block w-full text-left text-sm leading-snug"
                    >
                      {sub.text}
                    </button>
                  )}
                  <input
                    value={sub.note ?? ""}
                    onChange={(e) =>
                      dispatch({
                        type: "TEMPLATE_SUBSTEP_UPDATE",
                        templateId,
                        stageIndex,
                        subIndex: i,
                        patch: { note: e.target.value },
                      })
                    }
                    placeholder="메모 (시각·온도 등)"
                    className="mt-0.5 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-neutral-600 placeholder-neutral-400 hover:border-neutral-200 focus:border-neutral-900 focus:bg-white focus:outline-none dark:text-neutral-300 dark:hover:border-neutral-700 dark:focus:border-white dark:focus:bg-neutral-900"
                  />
                </div>

                <div className="flex flex-shrink-0 items-center gap-0.5">
                  <MiniBtn
                    label="위로"
                    disabled={isFirst}
                    onClick={() =>
                      dispatch({
                        type: "TEMPLATE_SUBSTEP_MOVE",
                        templateId,
                        stageIndex,
                        subIndex: i,
                        dir: "up",
                      })
                    }
                  >
                    ▲
                  </MiniBtn>
                  <MiniBtn
                    label="아래로"
                    disabled={isLast}
                    onClick={() =>
                      dispatch({
                        type: "TEMPLATE_SUBSTEP_MOVE",
                        templateId,
                        stageIndex,
                        subIndex: i,
                        dir: "down",
                      })
                    }
                  >
                    ▼
                  </MiniBtn>
                  <MiniBtn
                    label="삭제"
                    danger
                    onClick={() => {
                      if (window.confirm(`"${sub.text}" 하위 동선을 삭제할까요?`)) {
                        dispatch({
                          type: "TEMPLATE_SUBSTEP_DELETE",
                          templateId,
                          stageIndex,
                          subIndex: i,
                        });
                      }
                    }}
                  >
                    ×
                  </MiniBtn>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex gap-1">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="+ 하위 동선 추가"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-neutral-900 px-2 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          추가
        </button>
      </div>
    </div>
  );
}

function MiniBtn({
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
        "inline-flex h-6 w-6 items-center justify-center rounded text-xs",
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
