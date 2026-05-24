import { MESSAGES } from "../../data/seed";
import { useAppStore } from "../../store/useAppStore";
import { MessageCard } from "./MessageCard";
import { VariablePanel } from "./VariablePanel";

export function MessagesTab() {
  const { currentJob } = useAppStore();
  if (!currentJob) return null;

  return (
    <div className="space-y-3">
      <VariablePanel job={currentJob} />
      <p className="px-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        본문의 <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{`{{변수}}`}</code>는 위에서 입력한 값으로 치환되어 복사됩니다. 미입력 항목은 <span className="rounded bg-red-100 px-1 text-red-700 dark:bg-red-950 dark:text-red-300">[변수명]</span>으로 표시됩니다.
      </p>
      <div className="space-y-2">
        {MESSAGES.map((m) => (
          <MessageCard key={m.no} msg={m} vars={currentJob.vars} />
        ))}
      </div>
    </div>
  );
}
