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
  // 사이사이 + 슬롯의 인라인 입력창을 열어둔 위치 (null = 닫힘)
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [insertText, setInsertText] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  function commitInsert() {
    if (insertAt == null) return;
    const t = insertText.trim();
    if (!t) {
      setInsertAt(null);
      setInsertText("");
      return;
    }
    dispatch({
      type: "TEMPLATE_SUBSTEP_INSERT",
      templateId,
      stageIndex,
      subIndex: insertAt,
      text: t,
    });
    setInsertAt(null);
    setInsertText("");
  }

  function openInsert(at: number) {
    setInsertAt(at);
    setInsertText("");
    setEditingIdx(null);
  }

  return (
    <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-2 dark:border-neutral-800 dark:bg-neutral-950/40">
      <ul className="space-y-0">
        {/* 맨 위 슬롯 */}
        <InsertSlot
          active={insertAt === 0}
          onOpen={() => openInsert(0)}
          value={insertText}
          onChange={setInsertText}
          onCommit={commitInsert}
          onCancel={() => {
            setInsertAt(null);
            setInsertText("");
          }}
        />

        {substeps.map((sub, i) => {
          const isFirst = i === 0;
          const isLast = i === substeps.length - 1;
          const isEditing = editingIdx === i;
          return (
            <li key={i}>
              <div className="rounded-md bg-white px-2 py-1.5 dark:bg-neutral-900">
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
                        onClick={() => {
                          setEditingIdx(i);
                          setInsertAt(null);
                        }}
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
              </div>

              {/* 각 substep 아래 + 슬롯 */}
              <InsertSlot
                active={insertAt === i + 1}
                onOpen={() => openInsert(i + 1)}
                value={insertText}
                onChange={setInsertText}
                onCommit={commitInsert}
                onCancel={() => {
                  setInsertAt(null);
                  setInsertText("");
                }}
              />
            </li>
          );
        })}
      </ul>

      {substeps.length === 0 && insertAt !== 0 && (
        <p className="px-1 py-2 text-center text-[11px] text-neutral-500">
          하위 동선이 없습니다. 위의 <strong>+</strong> 버튼으로 추가하세요.
        </p>
      )}
    </div>
  );
}

interface InsertSlotProps {
  active: boolean;
  onOpen: () => void;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function InsertSlot({ active, onOpen, value, onChange, onCommit, onCancel }: InsertSlotProps) {
  if (active) {
    return (
      <div className="my-1.5 flex gap-1 rounded-md border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit();
            }
            if (e.key === "Escape") onCancel();
          }}
          placeholder="하위 동선 내용"
          className="flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-xs focus:outline-none"
        />
        <button
          type="button"
          onClick={onCommit}
          className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          추가
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          취소
        </button>
      </div>
    );
  }
  return (
    <div className="group relative h-2.5 hover:h-6 transition-[height]">
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-transparent group-hover:bg-neutral-300 dark:group-hover:bg-neutral-700"
      />
      <button
        type="button"
        onClick={onOpen}
        aria-label="이 위치에 하위 동선 추가"
        className="absolute left-1/2 top-1/2 inline-flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-300 bg-white text-[10px] font-bold text-neutral-500 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-900 hover:text-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-white dark:hover:text-neutral-900"
      >
        +
      </button>
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
