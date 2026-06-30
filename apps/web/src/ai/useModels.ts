import type { ModelInfo } from "@schema-studio/core";
import { useEffect, useState } from "react";

import { MODEL_CATALOG, mergeModels } from "./models.js";
import { useAiProvider } from "./useAiProvider.js";

/**
 * The list of selectable models for the picker. Seeds with the static {@link MODEL_CATALOG} so the
 * dropdown is never empty, then — when a key is present — fetches the live list the key can access
 * and merges it in. Fetch failures (offline, lacking permission) silently keep the static catalog.
 */
export function useModels(): { models: ModelInfo[]; loading: boolean } {
  const provider = useAiProvider();
  const [models, setModels] = useState<ModelInfo[]>(MODEL_CATALOG);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provider?.listModels) {
      setModels(MODEL_CATALOG);
      return;
    }

    let active = true;
    setLoading(true);
    void provider
      .listModels()
      .then((fetched) => {
        if (active) {
          setModels(mergeModels(fetched));
        }
      })
      .catch(() => {
        // Keep the static catalog on any failure — the picker stays usable offline / without access.
        if (active) {
          setModels(MODEL_CATALOG);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [provider]);

  return { models, loading };
}
