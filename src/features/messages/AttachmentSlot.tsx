import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";
import { useAppStore } from "../../store/useAppStore";
import { AssetPickerModal } from "../assets/AssetPickerModal";
import { getAssetsByIds, type Asset } from "../../lib/assets";

interface Props {
  messageKey: string;
  attachmentIds: string[];
  onAttachmentsChange?: () => void;
}

export function AttachmentSlot({ messageKey, attachmentIds, onAttachmentsChange }: Props) {
  const { state, currentJob, dispatch } = useAppStore();
  const { show } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const defaultIds = new Set(state.defaultAttachments?.[messageKey] ?? []);

  useEffect(() => {
    let mounted = true;
    if (attachmentIds.length === 0) {
      setAssets([]);
      return;
    }
    getAssetsByIds(attachmentIds)
      .then((list) => {
        if (mounted) setAssets(list);
      })
      .catch((err) => {
        console.error("[attachments] load failed", err);
      });
    return () => {
      mounted = false;
    };
  }, [attachmentIds]);

  function onAdd(asset: Asset) {
    if (!currentJob) return;
    dispatch({
      type: "ATTACHMENT_ADD",
      jobId: currentJob.id,
      messageKey,
      assetId: asset.id,
    });
    show("첨부됨");
    onAttachmentsChange?.();
  }

  function onRemove(asset: Asset) {
    if (!currentJob) return;
    dispatch({
      type: "ATTACHMENT_REMOVE",
      jobId: currentJob.id,
      messageKey,
      assetId: asset.id,
    });
  }

  function toggleDefault(asset: Asset) {
    if (asset.kind !== "common") {
      show("공통 이미지만 기본 첨부 가능");
      return;
    }
    if (defaultIds.has(asset.id)) {
      dispatch({
        type: "DEFAULT_ATTACHMENT_REMOVE",
        messageKey,
        assetId: asset.id,
      });
      show("기본 첨부 해제됨");
    } else {
      dispatch({
        type: "DEFAULT_ATTACHMENT_ADD",
        messageKey,
        assetId: asset.id,
      });
      show("기본 첨부됨 (새 작업에 자동 적용)");
    }
  }

  return (
    <div className="mt-2 border-t border-dashed border-neutral-200 pt-2 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
          📎 함께 보낼 이미지 ({assets.length})
        </span>
        {assets.length > 0 && (
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            ★ 탭 = 기본 첨부 (새 작업에 자동)
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {assets.map((a) => {
          const isDefault = defaultIds.has(a.id);
          const isCommon = a.kind === "common";
          return (
            <div
              key={a.id}
              className="group relative h-14 w-14 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <img src={a.thumbDataUrl} alt={a.name} className="h-full w-full object-cover" />
              {isCommon && (
                <button
                  type="button"
                  onClick={() => toggleDefault(a)}
                  className={[
                    "absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-br-lg text-[11px] font-bold",
                    isDefault
                      ? "bg-amber-400 text-amber-900"
                      : "bg-black/60 text-white",
                  ].join(" ")}
                  aria-label={isDefault ? "기본 첨부 해제" : "기본 첨부로 지정"}
                  title={isDefault ? "기본 첨부 해제" : "기본 첨부로 지정"}
                >
                  ★
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(a)}
                className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-black/60 text-[10px] font-bold text-white"
                aria-label="첨부 해제"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-lg text-neutral-400 transition active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-800"
          aria-label="이미지 추가"
        >
          +
        </button>
      </div>

      <AssetPickerModal
        open={pickerOpen}
        excludeIds={attachmentIds}
        onClose={() => setPickerOpen(false)}
        onPick={onAdd}
      />
    </div>
  );
}
