import { createContext, useContext, type ReactNode } from "react";

import { useApiKey, type UseApiKey } from "./useApiKey.js";

const ApiKeyContext = createContext<UseApiKey | null>(null);

/**
 * Hoists the single {@link useApiKey} instance to the app root so the Copilot
 * pane and the dedicated BYO-key page read and write the *same* in-memory key
 * (two separate `useApiKey()` calls would only share persisted storage).
 */
export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const value = useApiKey();
  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>;
}

export function useApiKeyContext(): UseApiKey {
  const value = useContext(ApiKeyContext);
  if (!value) {
    throw new Error("useApiKeyContext must be used within an ApiKeyProvider");
  }
  return value;
}
