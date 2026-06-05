import { useCallback, useEffect, useState } from "react";
import {
  createAsset,
  deleteAsset,
  listAssets,
  updateAssetMeta,
  type Asset,
  type CreateAssetInput,
} from "../../lib/assets";

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listAssets();
      setAssets(list);
      setError(null);
    } catch (err) {
      console.error("[assets] listAssets failed", err);
      setError(err instanceof Error ? err.message : "이미지 불러오기 실패");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    listAssets()
      .then((list) => {
        if (mounted) setAssets(list);
      })
      .catch((err) => {
        console.error("[assets] initial load failed", err);
        if (mounted) setError(err instanceof Error ? err.message : "이미지 불러오기 실패");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const add = useCallback(
    async (input: CreateAssetInput) => {
      await createAsset(input);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteAsset(id);
      await refresh();
    },
    [refresh]
  );

  const update = useCallback(
    async (
      id: string,
      patch: Parameters<typeof updateAssetMeta>[1]
    ) => {
      await updateAssetMeta(id, patch);
      await refresh();
    },
    [refresh]
  );

  return { assets, loading, error, add, remove, update, refresh };
}
