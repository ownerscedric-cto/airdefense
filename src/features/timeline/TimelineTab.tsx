import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { TimelineMode } from "../../types";
import { ProgressBar } from "./ProgressBar";
import { StageEditor } from "./StageEditor";
import { StageItem } from "./StageItem";
import { TemplateManager } from "./TemplateManager";

export function TimelineTab() {
  const { currentJob, dispatch } = useAppStore();
  const [mode, setMode] = useState<TimelineMode>("site");
  const [adding, setAdding] = useState(false);

  if (!currentJob) return null;

  const stages =
    mode === "client" ? currentJob.clientStages : currentJob.siteStages;
  const doneCount = stages.filter((s) => s.done).length;
  const currentIdx = stages.findIndex((s) => !s.done);

  return (
    <div className="space-y-4">
      <ModeToggle mode={mode} onChange={setMode} />

      <section className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <ProgressBar done={doneCount} total={stages.length} />
        <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          {mode === "client"
            ? "고객에게 보내는 카톡 메시지의 시점 기준 타임라인입니다."
            : "현장 작업용 동선. 단계마다 방별 하위 동선을 체크·메모할 수 있습니다."}
        </p>
      </section>

      <TemplateManager jobId={currentJob.id} mode={mode} />

      <section className="space-y-2">
        {stages.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            단계가 없습니다. 아래 "+ 단계 추가"로 시작하세요.
          </div>
        )}
        {stages.map((s, i) => (
          <StageItem
            key={s.id}
            jobId={currentJob.id}
            mode={mode}
            stage={s}
            isCurrent={i === currentIdx}
            isFirst={i === 0}
            isLast={i === stages.length - 1}
          />
        ))}
      </section>

      <section>
        {adding ? (
          <StageEditor
            initial={{
              time:
                mode === "client"
                  ? new Date().toTimeString().slice(0, 5)
                  : "",
              title: "",
              detail: "",
              category: "준비",
            }}
            submitLabel="추가"
            onSave={(s) => {
              dispatch({
                type: "STAGE_ADD",
                jobId: currentJob.id,
                mode,
                stage: { ...s, done: false, substeps: [] },
              });
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            + 단계 추가
          </button>
        )}
      </section>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: TimelineMode;
  onChange: (m: TimelineMode) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-xl border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900">
      <ToggleBtn label="🛠 현장용" active={mode === "site"} onClick={() => onChange("site")} />
      <ToggleBtn label="💬 고객용" active={mode === "client"} onClick={() => onChange("client")} />
    </div>
  );
}

function ToggleBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white"
          : "text-neutral-500 dark:text-neutral-400",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
