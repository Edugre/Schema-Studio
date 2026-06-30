import { useCallback, useEffect, useState } from "react";

import { DEFAULT_MODEL } from "./models.js";

/**
 * The selected Claude model for all AI calls (Copilot, suggestion rerank, auto-draft). A
 * device-local preference persisted to localStorage like the theme/rerank/auto-draft toggles.
 * Defaults to {@link DEFAULT_MODEL} when unset. A custom event keeps other readers in this tab in
 * sync; the native `storage` event covers other tabs.
 */

const STORAGE_KEY = "schema-studio:model";
const CHANGE_EVENT = "schema-studio:model-change";

export function readModelPreference(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

function writeModelPreference(model: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, model);
  } catch {
    // Ignore storage failures (private mode, quota) — the choice still applies in-session.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: model }));
}

export function useModelPreference(): {
  model: string;
  setModel: (model: string) => void;
} {
  const [model, setModelState] = useState<string>(() => readModelPreference());

  useEffect(() => {
    const onChange = () => setModelState(readModelPreference());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setModel = useCallback((next: string) => {
    setModelState(next);
    writeModelPreference(next);
  }, []);

  return { model, setModel };
}
