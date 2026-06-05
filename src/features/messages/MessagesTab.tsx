import {
  MESSAGES,
  SHORT_GROUPS_AD_HOC,
  SHORT_GROUPS_AFTER_LONG,
  SHORT_MESSAGE_GROUPS,
  longMessageKey,
  shortMessageKey,
  type ShortMessageGroup,
} from "../../data/seed";
import { useAppStore } from "../../store/useAppStore";
import { MessageCard } from "./MessageCard";
import { ShortMessageChip } from "./ShortMessageChip";
import { VariablePanel } from "./VariablePanel";

const GROUP_BY_KEY = new Map<string, ShortMessageGroup>(
  SHORT_MESSAGE_GROUPS.map((g) => [g.key, g])
);

export function MessagesTab() {
  const { currentJob } = useAppStore();
  if (!currentJob) return null;

  const att = currentJob.messageAttachments ?? {};
  const ovr = currentJob.messageOverrides ?? {};
  const getIds = (key: string) => att[key] ?? [];
  const getOverride = (key: string): string | undefined => ovr[key];

  return (
    <div className="space-y-3">
      <VariablePanel job={currentJob} />
      <p className="px-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        본문의 <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{`{{변수}}`}</code>는 위에서 입력한 값으로 치환되어 공유됩니다. 미입력 항목은 <span className="rounded bg-red-100 px-1 text-red-700 dark:bg-red-950 dark:text-red-300">[변수명]</span>으로 표시됩니다.
      </p>

      <div className="space-y-3">
        {MESSAGES.map((m) => {
          const afterGroupKeys = SHORT_GROUPS_AFTER_LONG[m.no] ?? [];
          return (
            <div key={m.no} className="space-y-2">
              <MessageCard
                msg={m}
                vars={currentJob.vars}
                attachmentIds={getIds(longMessageKey(m.no))}
                overrideText={getOverride(longMessageKey(m.no))}
              />
              {afterGroupKeys.map((gk) => {
                const g = GROUP_BY_KEY.get(gk);
                if (!g) return null;
                return (
                  <ShortGroup
                    key={gk}
                    group={g}
                    getIds={getIds}
                    getOverride={getOverride}
                    indent
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {SHORT_GROUPS_AD_HOC.length > 0 && (
        <section className="space-y-3 pt-4">
          <header className="px-1">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              돌발 응대
            </h2>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              고객 문의·물품 등 즉석 응대용
            </p>
          </header>
          <div className="space-y-3">
            {SHORT_GROUPS_AD_HOC.map((gk) => {
              const g = GROUP_BY_KEY.get(gk);
              if (!g) return null;
              return (
                <ShortGroup key={gk} group={g} getIds={getIds} getOverride={getOverride} />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

interface ShortGroupProps {
  group: ShortMessageGroup;
  getIds: (key: string) => string[];
  getOverride: (key: string) => string | undefined;
  indent?: boolean;
}

function ShortGroup({ group, getIds, getOverride, indent }: ShortGroupProps) {
  return (
    <div className={["space-y-1.5", indent ? "pl-3" : ""].join(" ")}>
      <h3 className="px-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        ↳ {group.title}
      </h3>
      <div className="space-y-1.5">
        {group.messages.map((m, i) => {
          const key = shortMessageKey(group.key, i);
          return (
            <ShortMessageChip
              key={i}
              defaultText={m.text}
              overrideText={getOverride(key)}
              messageKey={key}
              attachmentIds={getIds(key)}
              groupTitle={group.title}
            />
          );
        })}
      </div>
    </div>
  );
}
