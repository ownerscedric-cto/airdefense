import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAppStore } from "../../store/useAppStore";
import type { Job } from "../../types";

interface Props {
  job: Job;
  active: boolean;
}

export function JobCard({ job, active }: Props) {
  const { dispatch } = useAppStore();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const clientDone = job.clientStages.filter((s) => s.done).length;
  const clientTotal = job.clientStages.length;
  const siteDone = job.siteStages.filter((s) => s.done).length;
  const siteTotal = job.siteStages.length;

  return (
    <div
      className={[
        "rounded-xl border p-3 transition-colors",
        active
          ? "border-neutral-900 bg-neutral-900/[0.03] dark:border-white dark:bg-white/[0.04]"
          : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: "JOB_SELECT", id: job.id })}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{job.customer || "(고객명 없음)"}</div>
            {active && (
              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-white dark:text-neutral-900">
                선택됨
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {[job.size, job.date, job.layout].filter(Boolean).join(" · ") || "정보 없음"}
          </div>
          {job.address && (
            <div className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {job.address}
            </div>
          )}
          <div className="mt-1 flex gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>🛠 {siteDone}/{siteTotal}</span>
            <span>💬 {clientDone}/{clientTotal}</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          삭제
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="작업 삭제"
        message={`"${job.customer || "(고객명 없음)"}" 작업을 삭제할까요?\n저장된 타임라인·체크리스트·변수도 함께 사라집니다.`}
        confirmLabel="삭제"
        danger
        onConfirm={() => {
          dispatch({ type: "JOB_DELETE", id: job.id });
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
