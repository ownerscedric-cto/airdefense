import { useCallback, useEffect, useState } from "react";
import { createAsset, type CreateAssetInput as CreateLocalInput } from "../../lib/assets";
import {
  deleteAnyAsset,
  encodeLocalId,
  encodeCloudId,
  listAllAssets,
  parseAssetId,
  updateAnyAssetMeta,
  type AnyAsset,
} from "../../lib/anyAsset";
import { uploadCloudAsset, type UploadCloudAssetInput } from "../../lib/db/cloudAssets";

export type AddAssetInput =
  | ({ target: "local" } & CreateLocalInput)
  | ({ target: "cloud" } & UploadCloudAssetInput);

export function useAssets() {
  const [assets, setAssets] = useState<AnyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listAllAssets();
      setAssets(list);
      setError(null);
    } catch (err) {
      console.error("[useAssets.refresh] failed", err);
      setError(err instanceof Error ? err.message : "이미지 불러오기 실패");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    listAllAssets()
      .then((list) => {
        if (mounted) setAssets(list);
      })
      .catch((err) => {
        console.error("[useAssets] initial load failed", err);
        if (mounted) setError(err instanceof Error ? err.message : "이미지 불러오기 실패");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  /** target 에 따라 로컬 IndexedDB 또는 Supabase Storage 에 업로드 */
  const add = useCallback(
    async (input: AddAssetInput) => {
      if (input.target === "local") {
        const { target: _t, ...rest } = input;
        await createAsset(rest);
      } else {
        const { target: _t, ...rest } = input;
        await uploadCloudAsset(rest);
      }
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (encodedId: string) => {
      await deleteAnyAsset(encodedId);
      await refresh();
    },
    [refresh]
  );

  const update = useCallback(
    async (encodedId: string, patch: Parameters<typeof updateAnyAssetMeta>[1]) => {
      await updateAnyAssetMeta(encodedId, patch);
      await refresh();
    },
    [refresh]
  );

  return { assets, loading, error, add, remove, update, refresh };
}

// ID 인코딩 헬퍼 외부 export
export { encodeCloudId, encodeLocalId, parseAssetId };
