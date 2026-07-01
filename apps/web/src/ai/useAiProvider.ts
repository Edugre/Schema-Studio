import type { AiProvider } from "@schema-studio/core";
import { useMemo } from "react";

import { useApiKeyContext } from "../copilot/ApiKeyContext.js";
import { AnthropicBrowserProvider } from "./AnthropicBrowserProvider.js";
import { useModelPreference } from "./modelPreference.js";
import { useTargetPreference } from "./targetPreference.js";

/**
 * The live AI provider built from the current BYO key, selected model, and target stack, or null
 * when no key is set. Shared by the copilot pane and the suggestion reranker so both read the same
 * in-memory key and rebuild the provider identically when the key, model, or target changes.
 */
export function useAiProvider(): AiProvider | null {
  const { apiKey } = useApiKeyContext();
  const { model } = useModelPreference();
  const { target } = useTargetPreference();
  return useMemo(() => {
    const trimmed = apiKey.trim();
    return trimmed ? new AnthropicBrowserProvider(trimmed, model, target) : null;
  }, [apiKey, model, target]);
}
