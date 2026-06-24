import { useCallback, useEffect, useRef, useState } from "react";

import { IndexedDbKeyValueStore } from "../persistence/kv.js";
import { clearStoredApiKey, getStoredApiKey, setStoredApiKey } from "../persistence/secretStore.js";
import type { KeyValueStore } from "../persistence/types.js";

export type UseApiKey = {
  apiKey: string;
  remember: boolean;
  /** Update the in-memory key. If "remember" is on, the new value is persisted too. */
  setApiKey: (key: string) => void;
  /** Toggle persistence. Turning on writes the current key; turning off erases the stored copy. */
  setRemember: (remember: boolean) => void;
};

/**
 * Owns the Anthropic API key. The key lives in memory by default and is only written to local
 * storage when the user opts in via "remember". The key/value backend is injectable for tests.
 */
export function useApiKey(
  createKv: () => KeyValueStore = () => new IndexedDbKeyValueStore(),
): UseApiKey {
  const kvRef = useRef<KeyValueStore | null>(null);
  if (kvRef.current === null) {
    kvRef.current = createKv();
  }
  const kv = kvRef.current;

  const [apiKey, setApiKeyState] = useState("");
  const [remember, setRememberState] = useState(false);

  // Hydrate a previously remembered key on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getStoredApiKey(kv);
      if (!cancelled && stored) {
        setApiKeyState(stored);
        setRememberState(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kv]);

  const setApiKey = useCallback(
    (key: string) => {
      setApiKeyState(key);
      if (remember) {
        if (key.trim()) {
          void setStoredApiKey(kv, key);
        } else {
          void clearStoredApiKey(kv);
        }
      }
    },
    [kv, remember],
  );

  const setRemember = useCallback(
    (next: boolean) => {
      setRememberState(next);
      if (next) {
        if (apiKey.trim()) {
          void setStoredApiKey(kv, apiKey);
        }
      } else {
        void clearStoredApiKey(kv);
      }
    },
    [kv, apiKey],
  );

  return { apiKey, remember, setApiKey, setRemember };
}
