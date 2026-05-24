import { useState } from "react";
import { MEASURE_COLUMNS, STANDARD } from "../../data/seed";
import { useAppStore } from "../../store/useAppStore";
import type { Job } from "../../types";

type Phase = "before" | "after";

interface Props {
  job: Job;
}

function cellStatus(col: string, raw: string): "ok" | "over" | "neutral" {
  if (!raw) return "neutral";
  const n = parseFloat(raw.replace(/[^\d.eE+\-]/g, ""));
  if (Number.isNaN(n)) return "neutral";
  if (col === "HCHO") return n > STANDARD.HCHO ? "over" : "ok";
  if (col === "TVOC") return n > STANDARD.TVOC ? "over" : "ok";
  return "neutral";
}

export function MeasureTable({ job }: Props) {
  const { dispatch } = useAppStore();
  const [phase, setPhase] = useState<Phase>("before");
  const [newRow, setNewRow] = useState("");

  const cells = job.checklist.measureCells[phase];

  function setCell(row: string, col: string, value: string) {
    dispatch({
      type: "MEASURE_CELL_SET",
      jobId: job.id,
      phase,
      row,
      col,
      value,
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">공기질 측정 기록표</h3>
        <div className="inline-flex rounded-lg border border-neutral-300 p-0.5 dark:border-neutral-700">
          {(["before", "after"] as Phase[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium",
                phase === p
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-300",
              ].join(" ")}
            >
              {p === "before" ? "시공 전" : "시공 후"}
            </button>
          ))}
        </div>
      </header>
      <div className="px-3 py-2 text-[11px] text-neutral-500 dark:text-neutral-400">
        환경부 기준치: HCHO ≤ {STANDARD.HCHO} mg/㎥ · TVOC ≤ {STANDARD.TVOC} mg/㎥
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900/60">
            <tr>
              <th className="sticky left-0 z-10 min-w-[112px] bg-neutral-50 px-2 py-2 text-left text-xs font-medium text-neutral-500 dark:bg-neutral-900/60">
                측정위치
              </th>
              {MEASURE_COLUMNS.map((c) => (
                <th
                  key={c}
                  className="px-2 py-2 text-left text-xs font-medium text-neutral-500"
                >
                  {c}
                </th>
              ))}
              <th className="w-10 px-2 py-2" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {job.checklist.measureRows.map((row) => (
              <tr
                key={row}
                className="border-t border-neutral-100 dark:border-neutral-800"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-2 py-2 text-left text-sm font-medium dark:bg-neutral-900"
                >
                  {row}
                </th>
                {MEASURE_COLUMNS.map((c) => {
                  const v = cells[row]?.[c] ?? "";
                  const st = cellStatus(c, v);
                  const cls =
                    st === "over"
                      ? "text-red-700 dark:text-red-300 font-semibold"
                      : st === "ok"
                      ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "";
                  return (
                    <td key={c} className="px-1 py-1">
                      <input
                        inputMode="decimal"
                        value={v}
                        onChange={(e) => setCell(row, c, e.target.value)}
                        placeholder="—"
                        className={`w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm tabular-nums hover:border-neutral-200 focus:border-neutral-900 focus:bg-white focus:outline-none dark:hover:border-neutral-700 dark:focus:border-white dark:focus:bg-neutral-900 ${cls}`}
                      />
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`"${row}" 행을 삭제할까요?`))
                        dispatch({
                          type: "MEASURE_ROW_DELETE",
                          jobId: job.id,
                          name: row,
                        });
                    }}
                    aria-label={`${row} 행 삭제`}
                    className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
        <input
          value={newRow}
          onChange={(e) => setNewRow(e.target.value)}
          placeholder="측정위치 추가"
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (newRow.trim()) {
                dispatch({ type: "MEASURE_ROW_ADD", jobId: job.id, name: newRow });
                setNewRow("");
              }
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (!newRow.trim()) return;
            dispatch({ type: "MEASURE_ROW_ADD", jobId: job.id, name: newRow });
            setNewRow("");
          }}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          추가
        </button>
      </footer>
    </section>
  );
}
