import { useState } from "react";
import { VAR_KEYS } from "../../data/seed";
import { useAppStore } from "../../store/useAppStore";
import type { Job, VarKey } from "../../types";

interface Props {
  job: Job;
}

const fieldCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white";

export function VariablePanel({ job }: Props) {
  const { dispatch } = useAppStore();
  const [open, setOpen] = useState(true);

  function update(k: VarKey, v: string) {
    dispatch({ type: "VARS_UPDATE", jobId: job.id, patch: { [k]: v } });
  }

  const missing = VAR_KEYS.filter((k) => !job.vars[k] || job.vars[k].trim() === "").length;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          🧩 변수 입력
          {missing > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              미입력 {missing}
            </span>
          )}
        </span>
        <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-2 border-t border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
          {VAR_KEYS.map((k) => (
            <label key={k} className="block">
              <span className="text-xs text-neutral-500">{k}</span>
              <input
                className={fieldCls}
                value={job.vars[k]}
                onChange={(e) => update(k, e.target.value)}
                placeholder={k === "시공비" ? "예: 350,000원" : ""}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
