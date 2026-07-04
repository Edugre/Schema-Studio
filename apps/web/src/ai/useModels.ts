import type { ModelInfo } from "@schema-studio/core";
import { useEffect, useState } from "react";

import { useApiKeyContext } from "../copilot/ApiKeyContext.js";
import { mergeModels } from "./models.js";
import { useProviderPreference } from "./providerPreference.js";
import { PROVIDERS, PROVIDER_IDS, type ProviderId } from "./providers.js";
import { useAiProvider } from "./useAiProvider.js";
import { useTargetPreference } from "./targetPreference.js";

/** A selectable model tagged with the provider it belongs to, for the unified picker. */
export type ProviderModel = ModelInfo & { provider: ProviderId };

/** The union of every provider's static catalog, tagged by provider. Never empty. */
function staticProviderModels(): ProviderModel[] {
  return PROVIDER_IDS.flatMap((id) =>
    PROVIDERS[id].catalog.map((model) => ({ ...model, provider: id })),
  );
}

/**
 * The list of selectable models for the picker. Seeds with the active provider's static catalog so
 * the dropdown is never empty, then — when a key is present — fetches the live list the key can
 * access and merges it in. Fetch failures (offline, lacking permission) silently keep the static
 * catalog.
 */
export function useModels(): { models: ModelInfo[]; loading: boolean } {
  const { provider: providerId } = useProviderPreference();
  const catalog = PROVIDERS[providerId].catalog;
  const provider = useAiProvider();
  const [models, setModels] = useState<ModelInfo[]>(catalog);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provider?.listModels) {
      setModels(catalog);
      return;
    }

    let active = true;
    setLoading(true);
    void provider
      .listModels()
      .then((fetched) => {
        if (active) {
          setModels(mergeModels(fetched, catalog));
        }
      })
      .catch(() => {
        // Keep the static catalog on any failure — the picker stays usable offline / without access.
        if (active) {
          setModels(catalog);
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
  }, [provider, catalog]);

  return { models, loading };
}

/**
 * The union of selectable models across ALL providers, tagged by provider — the source for the
 * unified model dropdown. Seeds from every provider's static catalog, then fetches the live list
 * for each provider that has a key and merges it in. Per-provider fetch failures silently keep
 * that provider's static catalog. The request is keyed on a serialized snapshot of the keys +
 * target so it re-runs when a key is added/removed or the target changes.
 */
export function useAllModels(): { models: ProviderModel[]; loading: boolean } {
  const { keyFor } = useApiKeyContext();
  const { target } = useTargetPreference();

  // A stable primitive dep: refetch on any key or target change, without a new-array identity loop.
  const payload = JSON.stringify({
    keys: PROVIDER_IDS.map((id) => ({ id, key: keyFor(id).apiKey.trim() })),
    target,
  });

  const [models, setModels] = useState<ProviderModel[]>(staticProviderModels);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { keys, target: tgt } = JSON.parse(payload) as {
      keys: Array<{ id: ProviderId; key: string }>;
      target: typeof target;
    };

    const tagged = (id: ProviderId, list: ModelInfo[]): ProviderModel[] =>
      list.map((model) => ({ ...model, provider: id }));

    if (keys.every((entry) => !entry.key)) {
      setModels(staticProviderModels());
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void Promise.all(
      keys.map(async ({ id, key }): Promise<ProviderModel[]> => {
        const fallback = tagged(id, PROVIDERS[id].catalog);
        if (!key) {
          return fallback;
        }
        const provider = PROVIDERS[id].create(key, PROVIDERS[id].defaultModel, tgt);
        if (!provider.listModels) {
          return fallback;
        }
        try {
          const fetched = await provider.listModels();
          return tagged(id, mergeModels(fetched, PROVIDERS[id].catalog));
        } catch {
          // Keep the static catalog for this provider on any failure.
          return fallback;
        }
      }),
    )
      .then((lists) => {
        if (active) {
          setModels(lists.flat());
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
  }, [payload]);

  return { models, loading };
}
