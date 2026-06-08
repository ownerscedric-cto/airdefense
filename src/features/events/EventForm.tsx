import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";
import {
  createEvent,
  updateEvent,
  type CreateEventInput,
} from "../../lib/db/events";
import type { EventRow, ServiceType } from "../../lib/db/types";

interface Props {
  open: boolean;
  serviceTypes: ServiceType[];
  initial?: EventRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

export function EventForm({ open, serviceTypes, initial, onClose, onSaved }: Props) {
  const { show } = useToast();
  const [form, setForm] = useState<CreateEventInput>(() => ({
    service_type: initial?.service_type ?? serviceTypes[0]?.code ?? "",
    title: initial?.title ?? "",
    starts_at: initial?.starts_at ?? new Date().toISOString(),
    ends_at: initial?.ends_at ?? null,
    customer: initial?.customer ?? "",
    address: initial?.address ?? "",
    size: initial?.size ?? "",
    layout: initial?.layout ?? "",
    notes: initial?.notes ?? "",
  }));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        service_type: initial?.service_type ?? serviceTypes[0]?.code ?? "",
        title: initial?.title ?? "",
        starts_at: initial?.starts_at ?? new Date().toISOString(),
        ends_at: initial?.ends_at ?? null,
        customer: initial?.customer ?? "",
        address: initial?.address ?? "",
        size: initial?.size ?? "",
        layout: initial?.layout ?? "",
        notes: initial?.notes ?? "",
      });
    }
  }, [open, initial, serviceTypes]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.service_type || !form.title || !form.starts_at) {
      show("필수 항목을 입력하세요");
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await updateEvent(initial.id, form);
        show("일정 수정됨");
      } else {
        await createEvent(form);
        show("일정 등록됨 — 첫 매니저에게 배분 시작");
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      show(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <form
        onSubmit={onSubmit}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-neutral-900 sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h3 className="text-base font-semibold">{initial ? "일정 수정" : "일정 등록"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
          <Field label="서비스 종류 *">
            <select
              value={form.service_type}
              onChange={(e) => setForm({ ...form, service_type: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
            >
              {serviceTypes.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="제목 *">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
              placeholder="예: 에피트온더파크 102-1802호"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="시작 *">
              <input
                type="datetime-local"
                value={toLocalInput(form.starts_at)}
                onChange={(e) => setForm({ ...form, starts_at: fromLocalInput(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
                required
              />
            </Field>
            <Field label="종료 (선택)">
              <input
                type="datetime-local"
                value={toLocalInput(form.ends_at)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ends_at: e.target.value ? fromLocalInput(e.target.value) : null,
                  })
                }
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </Field>
          </div>

          <Field label="고객명">
            <input
              type="text"
              value={form.customer ?? ""}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </Field>

          <Field label="주소">
            <input
              type="text"
              value={form.address ?? ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="평수">
              <input
                type="text"
                value={form.size ?? ""}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="예: 32평"
              />
            </Field>
            <Field label="구조">
              <input
                type="text"
                value={form.layout ?? ""}
                onChange={(e) => setForm({ ...form, layout: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
                placeholder="예: 방3 화2"
              />
            </Field>
          </div>

          <Field label="메모">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </Field>
        </div>

        <footer className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {busy ? "저장 중…" : initial ? "수정" : "등록"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
        {label}
      </span>
      {children}
    </label>
  );
}
