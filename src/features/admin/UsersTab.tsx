import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/Toast";
import {
  listProfiles,
  setProfileActive,
  setProfileDispatchOrder,
  setProfileRole,
} from "../../lib/db/profiles";
import type { Profile, Role } from "../../lib/db/types";

const ROLE_LABELS: Record<Role, string> = {
  pending: "대기",
  viewer: "뷰어",
  manager: "팀장",
  admin: "관리자",
};

const ROLE_OPTIONS: Role[] = ["pending", "viewer", "manager", "admin"];

export function UsersTab() {
  const { show } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listProfiles();
      setProfiles(list);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "불러오기 실패");
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const grouped = useMemo(() => {
    const pending = profiles.filter((p) => p.role === "pending");
    const managers = profiles
      .filter((p) => p.role === "manager")
      .sort((a, b) => {
        const ao = a.dispatch_order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.dispatch_order ?? Number.MAX_SAFE_INTEGER;
        return ao - bo;
      });
    const others = profiles.filter(
      (p) => p.role === "admin" || p.role === "viewer"
    );
    return { pending, managers, others };
  }, [profiles]);

  async function changeRole(p: Profile, role: Role) {
    try {
      await setProfileRole(p.id, role);
      show("역할 변경됨");
      refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "변경 실패");
    }
  }

  async function changeActive(p: Profile, active: boolean) {
    try {
      await setProfileActive(p.id, active);
      show(active ? "활성화됨" : "비활성화됨");
      refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "변경 실패");
    }
  }

  async function moveOrder(p: Profile, dir: "up" | "down") {
    const ordered = grouped.managers;
    const idx = ordered.findIndex((m) => m.id === p.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    // dispatch_order 가 비어있는 경우 1..N으로 재정렬
    const reordered = [...ordered];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    try {
      // 모두 1부터 다시 부여
      for (let i = 0; i < reordered.length; i++) {
        const target = reordered[i];
        if (target.dispatch_order !== i + 1) {
          await setProfileDispatchOrder(target.id, i + 1);
        }
      }
      show("순서 변경됨");
      refresh();
    } catch (err) {
      console.error("[moveOrder]", err, a.id, b.id);
      show(err instanceof Error ? err.message : "순서 변경 실패");
    }
  }

  async function autoOrderManagers() {
    try {
      for (let i = 0; i < grouped.managers.length; i++) {
        const m = grouped.managers[i];
        if (m.dispatch_order !== i + 1) {
          await setProfileDispatchOrder(m.id, i + 1);
        }
      }
      show("순서 정리됨");
      refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "정리 실패");
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-neutral-500">불러오는 중…</div>;
  }

  return (
    <div className="space-y-5 pb-4">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          ⚠ {error}
        </div>
      )}

      {grouped.pending.length > 0 && (
        <Section title={`승인 대기 (${grouped.pending.length})`} hint="신규 가입자를 검토하세요">
          <ul className="space-y-2">
            {grouped.pending.map((p) => (
              <UserRow
                key={p.id}
                profile={p}
                onRoleChange={(r) => changeRole(p, r)}
                onActiveChange={(a) => changeActive(p, a)}
              />
            ))}
          </ul>
        </Section>
      )}

      <Section
        title={`팀장 (${grouped.managers.length})`}
        hint="↑↓ 버튼으로 배분 순서 조정. 위에서부터 라운드로빈."
        action={
          grouped.managers.length > 0 && (
            <button
              type="button"
              onClick={autoOrderManagers}
              className="rounded-lg border border-neutral-300 px-2 py-1 text-[11px] dark:border-neutral-700"
            >
              번호 재정렬
            </button>
          )
        }
      >
        {grouped.managers.length === 0 ? (
          <p className="text-xs text-neutral-500">아직 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {grouped.managers.map((p, i) => (
              <UserRow
                key={p.id}
                profile={p}
                showOrder
                onMoveUp={i > 0 ? () => moveOrder(p, "up") : undefined}
                onMoveDown={i < grouped.managers.length - 1 ? () => moveOrder(p, "down") : undefined}
                onRoleChange={(r) => changeRole(p, r)}
                onActiveChange={(a) => changeActive(p, a)}
              />
            ))}
          </ul>
        )}
      </Section>

      {grouped.others.length > 0 && (
        <Section title={`관리자 · 뷰어 (${grouped.others.length})`}>
          <ul className="space-y-2">
            {grouped.others.map((p) => (
              <UserRow
                key={p.id}
                profile={p}
                onRoleChange={(r) => changeRole(p, r)}
                onActiveChange={(a) => changeActive(p, a)}
              />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

interface RowProps {
  profile: Profile;
  showOrder?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRoleChange: (r: Role) => void;
  onActiveChange: (a: boolean) => void;
}

function UserRow({
  profile,
  showOrder,
  onMoveUp,
  onMoveDown,
  onRoleChange,
  onActiveChange,
}: RowProps) {
  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {showOrder && (
              <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold tabular-nums text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                {profile.dispatch_order ?? "?"}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {profile.name || profile.email}
                {!profile.active && (
                  <span className="ml-1 text-[11px] text-neutral-500">(비활성)</span>
                )}
              </div>
              <div className="truncate text-[11px] text-neutral-500">{profile.email}</div>
            </div>
          </div>
        </div>
        {showOrder && (
          <div className="flex flex-shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              className="rounded border border-neutral-300 px-2 py-0.5 text-[10px] disabled:opacity-30 dark:border-neutral-700"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              className="rounded border border-neutral-300 px-2 py-0.5 text-[10px] disabled:opacity-30 dark:border-neutral-700"
            >
              ↓
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <select
          value={profile.role}
          onChange={(e) => onRoleChange(e.target.value as Role)}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onActiveChange(!profile.active)}
          className={[
            "rounded-lg border px-2 py-1.5 text-xs font-medium",
            profile.active
              ? "border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
              : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
          ].join(" ")}
        >
          {profile.active ? "비활성화" : "활성화"}
        </button>
      </div>
    </li>
  );
}
