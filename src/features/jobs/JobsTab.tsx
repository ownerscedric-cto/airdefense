import { useAppStore } from "../../store/useAppStore";
import { ImportExport } from "./ImportExport";
import { JobCard } from "./JobCard";
import { JobForm } from "./JobForm";

interface Props {
  onAfterCreate?: () => void;
}

export function JobsTab({ onAfterCreate }: Props) {
  const { state } = useAppStore();
  const jobs = [...state.jobs].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          작업
        </h2>
        <JobForm onCreated={onAfterCreate} />
      </section>

      <section className="space-y-2">
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            아직 등록된 작업이 없습니다.
            <br />
            위의 "+ 새 작업 만들기"로 첫 작업을 등록해 주세요.
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} active={state.currentJobId === j.id} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2 pt-2">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          백업 / 이전
        </h2>
        <ImportExport />
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          기기 간 데이터 이전이나 백업 용도로 사용하세요. 가져오기는 현재 데이터를 덮어씁니다.
        </p>
      </section>
    </div>
  );
}
