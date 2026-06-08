import { useMemo, useState } from "react";
import { useAuth } from "../../store/AuthProvider";
import type { EventRow, ServiceType } from "../../lib/db/types";
import { useEvents } from "./useEvents";
import { EventForm } from "./EventForm";
import { EventDetail } from "./EventDetail";

type Filter = "upcoming" | "mine" | "needs-response" | "all";

export function EventsTab() {
  const { user, role } = useAuth();
  const { events, serviceTypes, loading, error, refresh } = useEvents();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EventRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<EventRow | null>(null);
  const isAdmin = role === "admin";

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = events.slice();
    if (filter === "upcoming") {
      list = list.filter(
        (e) => new Date(e.starts_at).getTime() >= now - 1000 * 60 * 60 * 24
      );
    } else if (filter === "mine") {
      list = list.filter((e) => e.assigned_to === user?.id);
    } else if (filter === "needs-response") {
      list = list.filter((e) => e.status === "dispatching");
    }
    return list;
  }, [events, filter, user]);

  return (
    <div className="space-y-3 pb-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              ["upcoming", "다가오는"],
              ["mine", "내 일정"],
              ["needs-response", "배정 중"],
              ["all", "전체"],
            ] as Array<[Filter, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition",
                filter === k
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            className="flex-shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            + 일정
          </button>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-neutral-500">불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-neutral-500">일정이 없습니다.</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <EventListItem
              key={e.id}
              event={e}
              serviceTypes={serviceTypes}
              onClick={() => setDetailTarget(e)}
            />
          ))}
        </ul>
      )}

      <EventForm
        open={formOpen}
        serviceTypes={serviceTypes}
        initial={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />

      <EventDetail
        open={!!detailTarget}
        event={detailTarget}
        serviceTypes={serviceTypes}
        onClose={() => setDetailTarget(null)}
        onChanged={refresh}
        onEdit={
          isAdmin && detailTarget
            ? () => {
                setEditTarget(detailTarget);
                setDetailTarget(null);
                setFormOpen(true);
              }
            : undefined
        }
      />
    </div>
  );
}

interface ItemProps {
  event: EventRow;
  serviceTypes: ServiceType[];
  onClick: () => void;
}

function EventListItem({ event, serviceTypes, onClick }: ItemProps) {
  const { user } = useAuth();
  const serviceLabel =
    serviceTypes.find((s) => s.code === event.service_type)?.label ?? event.service_type;
  const isMyAssigned = event.assigned_to === user?.id;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="block w-full rounded-xl border border-neutral-200 bg-white p-3 text-left transition active:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:active:bg-neutral-800"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold">{event.title}</h3>
              {isMyAssigned && (
                <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  내 일정
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {serviceLabel} · {formatDateTime(event.starts_at)}
            </div>
            {event.customer && (
              <div className="text-xs text-neutral-600 dark:text-neutral-300">
                {event.customer}
                {event.size ? ` · ${event.size}` : ""}
              </div>
            )}
          </div>
          <StatusBadge status={event.status} />
        </div>
      </button>
    </li>
  );
}

function StatusBadge({ status }: { status: EventRow["status"] }) {
  const map: Record<EventRow["status"], { label: string; cls: string }> = {
    dispatching: { label: "배정 중", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    assigned: { label: "배정됨", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    declined_all: { label: "전원 거절", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
    completed: { label: "완료", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
    cancelled: { label: "취소", cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" },
  };
  const s = map[status];
  return (
    <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
