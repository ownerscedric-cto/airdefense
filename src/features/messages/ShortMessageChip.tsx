import { useState } from "react";
import { useToast } from "../../components/Toast";
import { shareFiles, shareText } from "../../lib/share";
import { assetToFile, getAssetsByIds } from "../../lib/assets";
import { useAppStore } from "../../store/useAppStore";
import { AttachmentSlot } from "./AttachmentSlot";
import { MessageEditDialog } from "./MessageEditDialog";

interface Props {
  defaultText: string;
  overrideText?: string;
  messageKey: string;
  attachmentIds: string[];
  groupTitle: string;
}

export function ShortMessageChip({
  defaultText,
  overrideText,
  messageKey,
  attachmentIds,
  groupTitle,
}: Props) {
  const { show } = useToast();
  const { currentJob, dispatch } = useAppStore();
  const hasFiles = attachmentIds.length > 0;
  const effectiveText = overrideText ?? defaultText;
  const isOverridden = overrideText !== undefined;
  const [editOpen, setEditOpen] = useState(false);

  async function onShareText() {
    try {
      const result = await shareText(effectiveText);
      if (result === "shared") show("공유 시트 열림");
      else if (result === "copied") show("복사됨");
      else if (result === "failed") show("공유 실패");
    } catch (err) {
      console.error("[ShortMessageChip.onShareText]", err);
      show(err instanceof Error ? err.message : "공유 실패");
    }
  }

  async function onShareImages() {
    if (!hasFiles) return;
    try {
      const assets = await getAssetsByIds(attachmentIds);
      const files = await Promise.all(assets.map((a) => assetToFile(a)));
      const result = await shareFiles(files);
      if (result === "shared") show("이미지 공유 시트 열림");
      else if (result === "failed") show("이미지 공유 실패");
    } catch (err) {
      console.error("[ShortMessageChip.onShareImages]", err);
      show(err instanceof Error ? err.message : "이미지 공유 실패");
    }
  }

  function onSaveEdit(text: string) {
    if (!currentJob) return;
    if (text === defaultText) {
      dispatch({ type: "MESSAGE_OVERRIDE_CLEAR", jobId: currentJob.id, messageKey });
    } else {
      dispatch({ type: "MESSAGE_OVERRIDE_SET", jobId: currentJob.id, messageKey, text });
    }
    show("저장됨");
  }

  function onResetEdit() {
    if (!currentJob) return;
    dispatch({ type: "MESSAGE_OVERRIDE_CLEAR", jobId: currentJob.id, messageKey });
    show("기본값으로 복원");
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={onShareText}
          className="flex flex-1 items-start gap-2 rounded-md px-1 py-1 text-left text-sm leading-relaxed text-neutral-700 transition active:bg-neutral-100 dark:text-neutral-200 dark:active:bg-neutral-800"
        >
          <span className="mt-0.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden>
            ↗
          </span>
          <span className="flex-1 whitespace-pre-line">
            {effectiveText}
            {isOverridden && (
              <span className="ml-1 align-middle text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                ✏️
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex-shrink-0 self-start rounded-md border border-neutral-300 px-1.5 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
          aria-label="멘트 편집"
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={onShareImages}
          disabled={!hasFiles}
          className="flex-shrink-0 self-start rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-200"
          aria-label="이미지만 공유"
        >
          🖼{hasFiles ? ` ${attachmentIds.length}` : ""}
        </button>
      </div>
      <AttachmentSlot messageKey={messageKey} attachmentIds={attachmentIds} />

      <MessageEditDialog
        open={editOpen}
        title={groupTitle}
        defaultText={defaultText}
        currentText={effectiveText}
        isOverridden={isOverridden}
        onClose={() => setEditOpen(false)}
        onSave={onSaveEdit}
        onReset={onResetEdit}
      />
    </div>
  );
}
