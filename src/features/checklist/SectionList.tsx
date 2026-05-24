import { CHECKLIST_SECTIONS } from "../../data/seed";
import { useAppStore } from "../../store/useAppStore";
import type { Job } from "../../types";

interface Props {
  job: Job;
}

export function SectionList({ job }: Props) {
  const { dispatch } = useAppStore();
  return (
    <div className="space-y-3">
      {CHECKLIST_SECTIONS.map((sec) => {
        const sectionState = job.checklist.checks[sec.title] ?? {};
        const doneCount = sec.items.filter((it) => sectionState[it]).length;
        return (
          <section
            key={sec.title}
            className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          >
            <header className="flex items-baseline justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <h3 className="text-sm font-semibold">{sec.title}</h3>
              <span className="text-xs text-neutral-500 tabular-nums">
                {doneCount}/{sec.items.length}
              </span>
            </header>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {sec.items.map((it) => {
                const checked = !!sectionState[it];
                return (
                  <li key={it}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-900"
                        checked={checked}
                        onChange={() =>
                          dispatch({
                            type: "CHECK_TOGGLE",
                            jobId: job.id,
                            section: sec.title,
                            item: it,
                          })
                        }
                      />
                      <span
                        className={
                          checked
                            ? "text-neutral-400 line-through dark:text-neutral-500"
                            : ""
                        }
                      >
                        {it}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
