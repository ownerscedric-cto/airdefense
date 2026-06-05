import { useRef } from "react";
import { useToast } from "../../components/Toast";
import { useAppStore } from "../../store/useAppStore";
import type { AppState } from "../../types";

export function ImportExport() {
  const { state, dispatch } = useAppStore();
  const { show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  function onExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `air-defence-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    show("내보내기 완료");
  }

  function onImportClick() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text) as Partial<AppState>;
      if (!parsed || parsed.schemaVersion !== 2 || !Array.isArray(parsed.jobs)) {
        show("불러오기 실패: 파일 형식이 올바르지 않습니다");
        return;
      }
      const ok = window.confirm(
        "현재 모든 데이터를 가져온 파일로 덮어씁니다. 계속할까요?"
      );
      if (!ok) return;
      dispatch({
        type: "REPLACE_ALL",
        state: {
          schemaVersion: 2,
          jobs: parsed.jobs,
          currentJobId: parsed.currentJobId ?? parsed.jobs[0]?.id ?? null,
          templates: parsed.templates ?? [],
          defaultAttachments: parsed.defaultAttachments ?? {},
        },
      });
      show("가져오기 완료");
    } catch {
      show("불러오기 실패");
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onExport}
        className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        ⬇︎ JSON 내보내기
      </button>
      <button
        type="button"
        onClick={onImportClick}
        className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        ⬆︎ JSON 가져오기
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
