import { useState } from "react";
import { useToast } from "../../components/Toast";
import { useAppStore } from "../../store/useAppStore";
import type { TimelineMode } from "../../types";

interface Props {
  jobId: string;
  mode: TimelineMode;
}

export function TemplateManager({ jobId, mode }: Props) {
  const { state, dispatch } = useAppStore();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const templates = state.templates.filter((t) => t.mode === mode);
  const modeLabel = mode === "client" ? "고객용" : "현장용";

  function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      show("템플릿 이름을 입력하세요");
      return;
    }
    dispatch({ type: "TEMPLATE_SAVE", jobId, mode, name: trimmed });
    setName("");
    show("템플릿 저장됨");
  }

  function onApply(id: string) {
    if (!window.confirm("선택한 템플릿으로 현재 타임라인을 덮어씁니다. 계속할까요?")) return;
    dispatch({ type: "TEMPLATE_APPLY", jobId, mode, templateId: id });
    show("템플릿 적용됨");
  }

  function onDelete(id: string) {
    if (!window.confirm("이 템플릿을 삭제할까요?")) return;
    dispatch({ type: "TEMPLATE_DELETE", id });
    show("템플릿 삭제됨");
  }

  function onResetDefault() {
    if (!window.confirm(`${modeLabel} 기본 템플릿으로 초기화할까요?`)) return;
    dispatch({ type: "TEMPLATE_RESET_DEFAULT", jobId, mode });
    show("기본 템플릿으로 초기화됨");
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
      >
        <span>📚 {modeLabel} 템플릿 관리</span>
        <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-200 p-3 dark:border-neutral-800">
          <div>
            <div className="mb-1 text-xs text-neutral-500">
              현재 {modeLabel} 타임라인을 템플릿으로 저장
            </div>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === "client" ? "예: 24평 아파트" : "예: 방3 아파트 동선"}
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white"
              />
              <button
                type="button"
                onClick={onSave}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                저장
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs text-neutral-500">저장된 {modeLabel} 템플릿</div>
            <ul className="space-y-1">
              {templates.length === 0 && (
                <li className="text-xs text-neutral-500">저장된 템플릿이 없습니다.</li>
              )}
              {templates.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-2.5 py-2 text-sm dark:border-neutral-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {t.name}{" "}
                      {t.builtin && (
                        <span className="text-[10px] text-neutral-500">(기본)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {t.stages.length}단계
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onApply(t.id)}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      불러오기
                    </button>
                    {!t.builtin && (
                      <button
                        type="button"
                        onClick={() => onDelete(t.id)}
                        className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={onResetDefault}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {modeLabel} 기본 템플릿으로 초기화
          </button>
        </div>
      )}
    </div>
  );
}
