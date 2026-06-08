import type { TabKey } from "../types";

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const TABS: Tab[] = [
  { key: "events", label: "일정", icon: "📅" },
  { key: "chat", label: "채팅", icon: "💬" },
  { key: "jobs", label: "작업", icon: "📋" },
  { key: "timeline", label: "타임라인", icon: "⏱" },
  { key: "messages", label: "멘트", icon: "📨" },
  { key: "checklist", label: "체크", icon: "✅" },
  { key: "assets", label: "이미지", icon: "🖼" },
  { key: "users", label: "관리", icon: "👥", adminOnly: true },
];

interface Props {
  current: TabKey;
  onChange: (k: TabKey) => void;
  disabled?: Partial<Record<TabKey, boolean>>;
  isAdmin: boolean;
}

export function TabNav({ current, onChange, disabled = {}, isAdmin }: Props) {
  const visible = TABS.filter((t) => !t.adminOnly || isAdmin);
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/95"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-3xl overflow-x-auto">
        {visible.map((t) => {
          const isOn = current === t.key;
          const isDisabled = !!disabled[t.key];
          return (
            <button
              key={t.key}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(t.key)}
              className={[
                "flex flex-1 min-w-[64px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                "min-h-[52px]",
                isOn
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400",
                isDisabled ? "opacity-40" : "active:bg-neutral-100 dark:active:bg-neutral-900",
              ].join(" ")}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
