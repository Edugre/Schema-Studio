import { DEFAULT_TARGET, TargetIdSchema, type TargetId } from "@schema-studio/core";
import { useCallback, useEffect, useState } from "react";

/**
 * The target stack the copilot models toward (Postgres, Prisma, …). A device-local preference
 * persisted to localStorage like the model/theme/rerank toggles; it selects the {@link TargetProfile}
 * whose type vocabulary and idioms are injected into the copilot prompt. Defaults to
 * {@link DEFAULT_TARGET} when unset, and falls back to it when the stored value is unrecognized (a
 * profile that was removed, or a corrupted entry). A custom event keeps other readers in this tab in
 * sync; the native `storage` event covers other tabs.
 */

const STORAGE_KEY = "schema-studio:target";
const CHANGE_EVENT = "schema-studio:target-change";

export function readTargetPreference(): TargetId {
  try {
    const parsed = TargetIdSchema.safeParse(window.localStorage.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : DEFAULT_TARGET;
  } catch {
    return DEFAULT_TARGET;
  }
}

function writeTargetPreference(target: TargetId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, target);
  } catch {
    // Ignore storage failures (private mode, quota) — the choice still applies in-session.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: target }));
}

export function useTargetPreference(): {
  target: TargetId;
  setTarget: (target: TargetId) => void;
} {
  const [target, setTargetState] = useState<TargetId>(() => readTargetPreference());

  useEffect(() => {
    const onChange = () => setTargetState(readTargetPreference());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setTarget = useCallback((next: TargetId) => {
    setTargetState(next);
    writeTargetPreference(next);
  }, []);

  return { target, setTarget };
}
