import { Fragment, useState } from "react";
import { useToast } from "../../components/Toast";
import { shareFiles, shareText } from "../../lib/share";
import { renderSegments, renderTemplate } from "../../lib/template";
import { assetToFile, getAssetsByIds } from "../../lib/assets";
import { longMessageKey, type MessageTemplate } from "../../data/seed";
import { useAppStore } from "../../store/useAppStore";
import type { MessageVars } from "../../types";
import { AttachmentSlot } from "./AttachmentSlot";
import { MessageEditDialog } from "./MessageEditDialog";

interface Props {
  msg: MessageTemplate;
  vars: MessageVars;
  attachmentIds: string[];
  overrideText?: string;
}

export function MessageCard({ msg, vars, attachmentIds, overrideText }: Props) {
  const { show } = useToast();
  const { currentJob, dispatch } = useAppStore();
  const messageKey = longMessageKey(msg.no);
  const hasFiles = attachmentIds.length > 0;
  const effectiveBody = overrideText ?? msg.body;
  const isOverridden = overrideText !== undefined;
  const segments = renderSegments(effectiveBody, vars);
  const [editOpen, setEditOpen] = useState(false);

  async function onShareText() {
    try {
      const text = renderTemplate(effectiveBody, vars);
      const result = await shareText(text);
      if (result === "shared") show("공유 시트 열림");
      else if (result === "copied") show("복사됨");
      else if (result === "failed") show("공유 실패");
    } catch (err) {
      console.error("[MessageCard.onShareText]", err);
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
      console.error("[MessageCard.onShareImages]", err);
      show(err instanceof Error ? err.message : "이미지 공유 실패");
    }
  }

  function onSaveEdit(text: string) {
    if (!currentJob) return;
    if (text === msg.body) {
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
    <article className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold tabular-nums text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
            {msg.no}
          </span>
          <h3 className="truncate text-sm font-semibold">{msg.title}</h3>
          {isOverridden && (
            <span
              className="flex-shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              title="이 작업에서 수정된 멘트"
            >
              수정됨
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
            aria-label="멘트 편집"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={onShareText}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            텍스트
          </button>
          <button
            type="button"
            onClick={onShareImages}
            disabled={!hasFiles}
            className="rounded-lg border border-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-900 disabled:opacity-30 dark:border-white dark:text-white"
          >
            이미지{hasFiles ? ` (${attachmentIds.length})` : ""}
          </button>
        </div>
      </header>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
        {segments.map((seg, i) =>
          seg.missing ? (
            <span
              key={i}
              className="rounded bg-red-100 px-1 font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {seg.text}
            </span>
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          )
        )}
      </p>
      <AttachmentSlot messageKey={messageKey} attachmentIds={attachmentIds} />

      <MessageEditDialog
        open={editOpen}
        title={msg.title}
        defaultText={msg.body}
        currentText={effectiveBody}
        isOverridden={isOverridden}
        onClose={() => setEditOpen(false)}
        onSave={onSaveEdit}
        onReset={onResetEdit}
      />
    </article>
  );
}
