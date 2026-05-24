import { useMemo, useState } from "react";
import { useAppStore } from "../../store/useAppStore";

interface Props {
  onCreated?: () => void;
}

const fieldCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white";

export function JobForm({ onCreated }: Props) {
  const { state, dispatch } = useAppStore();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [size, setSize] = useState("");
  const [layout, setLayout] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [staff, setStaff] = useState("");

  const clientTemplates = useMemo(
    () => state.templates.filter((t) => t.mode === "client"),
    [state.templates]
  );
  const siteTemplates = useMemo(
    () => state.templates.filter((t) => t.mode === "site"),
    [state.templates]
  );

  const [clientTemplateId, setClientTemplateId] = useState<string>(
    clientTemplates[0]?.id ?? "builtin-client-default"
  );
  const [siteTemplateId, setSiteTemplateId] = useState<string>(
    siteTemplates[0]?.id ?? "builtin-site-default"
  );

  function reset() {
    setCustomer("");
    setAddress("");
    setSize("");
    setLayout("");
    setDate(new Date().toISOString().slice(0, 10));
    setStaff("");
    setClientTemplateId(clientTemplates[0]?.id ?? "builtin-client-default");
    setSiteTemplateId(siteTemplates[0]?.id ?? "builtin-site-default");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({
      type: "JOB_CREATE",
      data: {
        meta: { customer, address, size, layout, date, staff },
        clientTemplateId,
        siteTemplateId,
      },
    });
    reset();
    setOpen(false);
    onCreated?.();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        + 새 작업 만들기
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="text-sm font-semibold">새 작업</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 block">
          <span className="text-xs text-neutral-500">고객명</span>
          <input className={fieldCls} value={customer} onChange={(e) => setCustomer(e.target.value)} required />
        </label>
        <label className="col-span-2 block">
          <span className="text-xs text-neutral-500">주소</span>
          <input className={fieldCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">평형</span>
          <input className={fieldCls} value={size} onChange={(e) => setSize(e.target.value)} placeholder="24평" />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">집 구조</span>
          <input className={fieldCls} value={layout} onChange={(e) => setLayout(e.target.value)} placeholder="방3·화장실2" />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">시공일</span>
          <input type="date" className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">담당자</span>
          <input className={fieldCls} value={staff} onChange={(e) => setStaff(e.target.value)} />
        </label>
        <label className="col-span-2 block">
          <span className="text-xs text-neutral-500">💬 고객용 타임라인 템플릿</span>
          <select
            className={fieldCls}
            value={clientTemplateId}
            onChange={(e) => setClientTemplateId(e.target.value)}
          >
            {clientTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.builtin ? "(기본)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block">
          <span className="text-xs text-neutral-500">🛠 현장용 타임라인 템플릿</span>
          <select
            className={fieldCls}
            value={siteTemplateId}
            onChange={(e) => setSiteTemplateId(e.target.value)}
          >
            {siteTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.builtin ? "(기본)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          취소
        </button>
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          만들기
        </button>
      </div>
    </form>
  );
}
