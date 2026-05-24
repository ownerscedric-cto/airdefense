interface Props {
  done: number;
  total: number;
}

export function ProgressBar({ done, total }: Props) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">진행률</div>
        <div className="text-sm font-semibold tabular-nums">
          {done}/{total} <span className="text-xs font-normal text-neutral-500">({pct}%)</span>
        </div>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-neutral-900 transition-all dark:bg-white"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
