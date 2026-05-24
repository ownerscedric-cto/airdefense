import type { TabKey } from "../types";

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { key: "jobs", label: "작업", icon: "📋" },
  { key: "timeline", label: "타임라인", icon: "⏱" },
  { key: "messages", label: "멘트", icon: "💬" },
  { key: "checklist", label: "체크", icon: "✅" },
];

interface Props {
  current: TabKey;
  onChange: (k: TabKey) => void;
  disabled?: Partial<Record<TabKey, boolean>>;
}

export function TabNav({ current, onChange, disabled = {} }: Props) {
  return (
    <nav
      className="sticky bottom-0 left-0 right-0 z-30 flex border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/95 md:relative md:bottom-auto md:border-t-0 md:border-b"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-3xl">
        {TABS.map((t) => {
          const isOn = current === t.key;
          const isDisabled = !!disabled[t.key];
          return (
            <button
              key={t.key}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(t.key)}
              className={[
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors",
                "min-h-[56px]",
                isOn
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400",
                isDisabled ? "opacity-40" : "active:bg-neutral-100 dark:active:bg-neutral-900",
              ].join(" ")}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span>{t.label}</span>
              {isOn && (
                <span className="absolute top-0 h-0.5 w-12 rounded-b bg-neutral-900 dark:bg-white md:bottom-0 md:top-auto" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
