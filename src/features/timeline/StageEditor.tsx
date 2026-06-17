import { useEffect, useState } from "react";
import { CATEGORIES, type Category, type Stage } from "../../types";
import { combineHM, splitMinutes } from "../../lib/timeOffset";

type EditorPayload = Pick<Stage, "time" | "title" | "category" | "detail"> & {
  offsetMinutes?: number;
};

interface Props {
  initial: EditorPayload & { id?: string };
  onSave: (s: EditorPayload) => void;
  onCancel: () => void;
  submitLabel?: string;
  /** 시각 입력 방식. "offset" = 상대(시공 시작 +HH:MM), "absolute" = 절대 시각. */
  timeMode?: "offset" | "absolute";
}

const fieldCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white";

export function StageEditor({
  initial,
  onSave,
  onCancel,
  submitLabel = "저장",
  timeMode = "offset",
}: Props) {
  const [time, setTime] = useState(initial.time);
  const initSplit = splitMinutes(initial.offsetMinutes ?? null);
  const [hours, setHours] = useState(initSplit.hours);
  const [minutes, setMinutes] = useState(initSplit.minutes);
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState<Category>(initial.category);
  const [detail, setDetail] = useState(initial.detail);

  useEffect(() => {
    setTime(initial.time);
    const sp = splitMinutes(initial.offsetMinutes ?? null);
    setHours(sp.hours);
    setMinutes(sp.minutes);
    setTitle(initial.title);
    setCategory(initial.category);
    setDetail(initial.detail);
  }, [initial.id]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: EditorPayload = {
      time,
      title: title.trim(),
      category,
      detail: detail.trim(),
    };
    if (timeMode === "offset") {
      payload.offsetMinutes = combineHM(hours, minutes);
      payload.time = ""; // offset 사용 시 절대 시각 비움 (헬퍼가 상대 표시)
    }
    onSave(payload);
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900/60">
      {timeMode === "offset" ? (
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-neutral-500">시작 +시간</span>
            <input
              type="number"
              min={0}
              max={12}
              className={fieldCls}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 0)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">+분</span>
            <input
              type="number"
              min={0}
              max={59}
              className={fieldCls}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 0)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">카테고리</span>
            <select
              className={fieldCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-neutral-500">시각 (선택)</span>
            <input
              type="time"
              className={fieldCls}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">카테고리</span>
            <select
              className={fieldCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className="block">
        <span className="text-xs text-neutral-500">단계명</span>
        <input
          className={fieldCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="text-xs text-neutral-500">설명</span>
        <textarea
          className={fieldCls + " min-h-[72px]"}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          취소
        </button>
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
