import { useState } from "react";
import { TabNav } from "./components/TabNav";
import { ToastProvider } from "./components/Toast";
import { AppStoreProvider, useAppStore } from "./store/useAppStore";
import { AuthProvider, useAuth } from "./store/AuthProvider";
import type { TabKey } from "./types";
import { JobsTab } from "./features/jobs/JobsTab";
import { TimelineTab } from "./features/timeline/TimelineTab";
import { MessagesTab } from "./features/messages/MessagesTab";
import { ChecklistTab } from "./features/checklist/ChecklistTab";
import { AssetsTab } from "./features/assets/AssetsTab";
import { EventsTab } from "./features/events/EventsTab";
import { ChatTab } from "./features/chat/ChatTab";
import { UsersTab } from "./features/admin/UsersTab";
import { TemplatesTab } from "./features/timeline/TemplatesTab";
import { LoginScreen } from "./features/auth/LoginScreen";
import { PendingScreen } from "./features/auth/PendingScreen";

function Shell() {
  const [tab, setTab] = useState<TabKey>("events");
  const { currentJob } = useAppStore();
  const { profile, user, signOut, role } = useAuth();

  const hasJob = !!currentJob;
  const disabled = hasJob
    ? {}
    : ({
        timeline: true,
        messages: true,
        checklist: true,
      } as Partial<Record<TabKey, boolean>>);

  const isAdmin = role === "admin";

  return (
    <div className="flex min-h-full flex-col">
      <Header
        userLabel={profile?.name || user?.email || ""}
        roleLabel={ROLE_LABEL[role] ?? ""}
        onLogout={signOut}
      />
      <main className="main-content mx-auto w-full max-w-3xl flex-1 px-4 pt-3">
        {tab === "events" && <EventsTab />}
        {tab === "chat" && <ChatTab />}
        {tab === "jobs" && <JobsTab onAfterCreate={() => setTab("timeline")} />}
        {tab === "timeline" &&
          (hasJob ? <TimelineTab /> : <EmptyHint onGo={() => setTab("jobs")} />)}
        {tab === "messages" &&
          (hasJob ? <MessagesTab /> : <EmptyHint onGo={() => setTab("jobs")} />)}
        {tab === "checklist" &&
          (hasJob ? <ChecklistTab /> : <EmptyHint onGo={() => setTab("jobs")} />)}
        {tab === "assets" && <AssetsTab />}
        {tab === "templates" && isAdmin && <TemplatesTab />}
        {tab === "users" && isAdmin && <UsersTab />}
      </main>
      <TabNav current={tab} onChange={setTab} disabled={disabled} isAdmin={isAdmin} />
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  manager: "팀장",
  viewer: "뷰어",
  pending: "대기",
  anon: "",
};

function Header({
  userLabel,
  roleLabel,
  onLogout,
}: {
  userLabel: string;
  roleLabel: string;
  onLogout: () => void;
}) {
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
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{roleLabel}</div>
            <div className="max-w-[40vw] truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
              {userLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-[11px] text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
          >
            로그아웃
          </button>
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

function AppGate() {
  const { loading, session, profile, role } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-neutral-500">
        로딩 중…
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  if (!profile || role === "anon" || role === "pending") return <PendingScreen />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppStoreProvider>
        <ToastProvider>
          <AppGate />
        </ToastProvider>
      </AppStoreProvider>
    </AuthProvider>
  );
}
