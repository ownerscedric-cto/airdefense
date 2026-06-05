import { useState } from "react";
import { TabNav } from "./components/TabNav";
import { ToastProvider } from "./components/Toast";
import { AppStoreProvider, useAppStore } from "./store/useAppStore";
import type { TabKey } from "./types";
import { JobsTab } from "./features/jobs/JobsTab";
import { TimelineTab } from "./features/timeline/TimelineTab";
import { MessagesTab } from "./features/messages/MessagesTab";
import { ChecklistTab } from "./features/checklist/ChecklistTab";
import { AssetsTab } from "./features/assets/AssetsTab";

function Shell() {
  const [tab, setTab] = useState<TabKey>("jobs");
  const { currentJob } = useAppStore();

  const hasJob = !!currentJob;
  const disabled = hasJob
    ? {}
    : { timeline: true, messages: true, checklist: true };

  return (
    <div className="flex min-h-full flex-col">
      <Header
        jobLabel={
          currentJob
            ? `${currentJob.customer || "(고객명 없음)"} · ${currentJob.size || "?"} · ${currentJob.date || "?"}`
            : "선택된 작업 없음"
        }
      />
      <main className="main-content mx-auto w-full max-w-3xl flex-1 px-4 pt-3">
        {tab === "jobs" && <JobsTab onAfterCreate={() => setTab("timeline")} />}
        {tab === "timeline" &&
          (hasJob ? <TimelineTab /> : <EmptyHint onGo={() => setTab("jobs")} />)}
        {tab === "messages" &&
          (hasJob ? <MessagesTab /> : <EmptyHint onGo={() => setTab("jobs")} />)}
        {tab === "checklist" &&
          (hasJob ? <ChecklistTab /> : <EmptyHint onGo={() => setTab("jobs")} />)}
        {tab === "assets" && <AssetsTab />}
      </main>
      <TabNav current={tab} onChange={setTab} disabled={disabled} />
    </div>
  );
}

function Header({ jobLabel }: { jobLabel: string }) {
  return (
    <header
      className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">공기수비대</div>
          <div className="text-sm font-semibold leading-tight">시공 어시스턴트</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">현재 작업</div>
          <div className="max-w-[60vw] truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
            {jobLabel}
          </div>
        </div>
      </div>
    </header>
  );
}

function EmptyHint({ onGo }: { onGo: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center">
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        먼저 작업을 선택하거나 새로 만들어 주세요.
      </div>
      <button
        type="button"
        onClick={onGo}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        작업 탭으로 이동
      </button>
    </div>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AppStoreProvider>
  );
}
