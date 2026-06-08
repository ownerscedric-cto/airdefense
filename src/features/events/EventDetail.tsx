import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../store/AuthProvider";
import {
  acceptAssignment,
  cancelEvent,
  completeEvent,
  declineAssignment,
  listAssignmentsForEvent,
} from "../../lib/db/events";
import { getProfilesByIds } from "../../lib/db/chat";
import type { EventAssignment, EventRow, Profile, ServiceType } from "../../lib/db/types";

interface Props {
  open: boolean;
  event: EventRow | null;
  serviceTypes: ServiceType[];
  onClose: () => void;
  onChanged: () => void;
  onEdit?: () => void;
}

export function EventDetail({
  open,
  event,
  serviceTypes,
  onClose,
  onChanged,
  onEdit,
}: Props) {
  const { user, role } = useAuth();
  const { show } = useToast();
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map());
  const [busy, setBusy] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);

  useEffect(() => {
    if (!open || !event) return;
    let mounted = true;
    listAssignmentsForEvent(event.id)
      .then(async (list) => {
        if (!mounted) return;
        setAssignments(list);
        const ids = Array.from(new Set(list.map((a) => a.manager_id)));
        if (ids.length > 0) {
          const map = await getProfilesByIds(ids);
          if (mounted) setProfileMap(map);
        }
      })
      .catch((err) => {
        console.error(err);
        if (mounted) show("배정 정보 불러오기 실패");
      });
    return () => {
      mounted = false;
    };
  }, [open, event, show]);

  if (!open || !event) return null;

  const myPending = assignments.find(
    (a) => a.manager_id === user?.id && a.status === "notified"
  );
  const isAdmin = role === "admin";
  const isMineAssigned = event.assigned_to === user?.id;
  const serviceLabel =
    serviceTypes.find((s) => s.code === event.service_type)?.label ?? event.service_type;

  async function onAccept() {
    if (!myPending) return;
    setBusy(true);
    try {
      await acceptAssignment(myPending.id);
      show("수락됨");
      onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "수락 실패");
    } finally {
      setBusy(false);
    }
  }

  async function onDecline() {
    if (!myPending) return;
    setBusy(true);
    try {
      await declineAssignment(myPending.id, declineReason || undefined);
      show("거절됨 — 다음 매니저에게 자동 재배분");
      setDeclineOpen(false);
      setDeclineReason("");
      onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "거절 실패");
    } finally {
      setBusy(false);
    }
  }

  async function onComplete() {
    if (!event) return;
    setBusy(true);
    try {
      await completeEvent(event.id);
      show("완료 처리됨");
      onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!event) return;
    if (!window.confirm("일정을 취소할까요?")) return;
    setBusy(true);
    try {
      await cancelEvent(event.id);
      show("취소됨");
      onChanged();
      onClose();
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "취소 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-neutral-900 sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold">{event.title}</h3>
              <StatusBadge status={event.status} />
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{serviceLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <DetailRow label="시작">{formatDateTime(event.starts_at)}</DetailRow>
          {event.ends_at && <DetailRow label="종료">{formatDateTime(event.ends_at)}</DetailRow>}
          {event.customer && <DetailRow label="고객">{event.customer}</DetailRow>}
          {event.address && <DetailRow label="주소">{event.address}</DetailRow>}
          {(event.size || event.layout) && (
            <DetailRow label="평수·구조">
              {[event.size, event.layout].filter(Boolean).join(" · ")}
            </DetailRow>
          )}
          {event.notes && (
            <DetailRow label="메모">
              <p className="whitespace-pre-line">{event.notes}</p>
            </DetailRow>
          )}

          <section>
            <h4 className="mb-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              배분 이력
            </h4>
            {assignments.length === 0 ? (
              <p className="text-xs text-neutral-500">아직 배분 시도가 없습니다.</p>
            ) : (
              <ul className="space-y-1.5">
                {assignments.map((a) => {
                  const p = profileMap.get(a.manager_id);
                  return (
                    <li
                      key={a.id}
                      className="flex items-start justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {a.try_order}. {p?.name || p?.email || "(알 수 없음)"}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {formatDateTime(a.notified_at)} 알림 · 만료 {formatDateTime(a.expires_at)}
                        </div>
                        {a.decline_reason && (
                          <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                            사유: {a.decline_reason}
                          </div>
                        )}
                      </div>
                      <AssignmentBadge status={a.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="space-y-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          {myPending && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeclineOpen(true)}
                disabled={busy}
                className="flex-1 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
              >
                거절
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="flex-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                수락
              </button>
            </div>
          )}

          {isMineAssigned && event.status === "assigned" && (
            <button
              type="button"
              onClick={onComplete}
              disabled={busy}
              className="w-full rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-300"
            >
              시공 완료로 표시
            </button>
          )}

          {isAdmin && (
            <div className="flex gap-2">
              {onEdit && event.status !== "completed" && event.status !== "cancelled" && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
                >
                  수정
                </button>
              )}
              {event.status !== "cancelled" && event.status !== "completed" && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
                >
                  취소
                </button>
              )}
            </div>
          )}
        </footer>

        {declineOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
              <h4 className="mb-2 text-base font-semibold">거절 사유 (선택)</h4>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                placeholder="다른 일정과 겹침 등"
                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeclineOpen(false);
                    setDeclineReason("");
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={onDecline}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  거절 확정
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-0.5 text-sm text-neutral-800 dark:text-neutral-100">{children}</div>
    </div>
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

function AssignmentBadge({ status }: { status: EventAssignment["status"] }) {
  const map: Record<EventAssignment["status"], { label: string; cls: string }> = {
    notified: { label: "응답 대기", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    accepted: { label: "수락", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
    declined: { label: "거절", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
    expired: { label: "시간 만료", cls: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" },
    skipped: { label: "건너뜀", cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" },
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
