import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  title: string;
  defaultText: string;
  currentText: string;
  isOverridden: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  onReset: () => void;
}

export function MessageEditDialog({
  open,
  title,
  defaultText,
  currentText,
  isOverridden,
  onClose,
  onSave,
  onReset,
}: Props) {
  const [value, setValue] = useState(currentText);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setValue(currentText);
      // 다음 프레임에 포커스 + 끝으로 커서
      requestAnimationFrame(() => {
        const ta = taRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      });
    }
  }, [open, currentText]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const changed = value !== currentText;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-neutral-900 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{title}</h3>
            {isOverridden && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                ✏️ 이 작업에서 수정된 멘트입니다
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={Math.min(20, Math.max(4, value.split("\n").length + 1))}
            className="w-full rounded-lg border border-neutral-300 bg-white p-3 text-sm leading-relaxed dark:border-neutral-700 dark:bg-neutral-950"
            placeholder="멘트 내용"
          />
          <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{`{{변수}}`}</code> 형식의 변수도 사용할 수 있어요. 공유 시 입력값으로 치환됩니다.
          </p>
          {isOverridden && (
            <details className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              <summary className="cursor-pointer select-none">기본 멘트 보기</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-[12px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
                {defaultText}
              </pre>
            </details>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            disabled={!isOverridden}
            className="rounded-lg px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            ↺ 기본값 복원
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!changed}
              onClick={() => {
                onSave(value);
                onClose();
              }}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-30 dark:bg-white dark:text-neutral-900"
            >
              저장
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
