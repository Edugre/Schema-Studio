import type { KeyValueStore } from "./types.js";

/**
 * Opt-in storage for the user's API key. This is a *secret*, kept deliberately separate from
 * project records: it is app-global, never included in project import/export, and only written
 * when the user explicitly asks us to remember it. It is stored unencrypted in the browser, so
 * it is readable by anyone with access to the device or via a successful XSS — the UI warns about
 * this and the feature defaults to off.
 *
 * The `secret:` prefix also keeps it clear of `listProjects`, which only scans `project:` keys.
 */
const API_KEY = "secret:anthropicApiKey";

export async function getStoredApiKey(kv: KeyValueStore): Promise<string | undefined> {
  const value = await kv.get<string>(API_KEY);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function setStoredApiKey(kv: KeyValueStore, key: string): Promise<void> {
  await kv.set(API_KEY, key);
}

export async function clearStoredApiKey(kv: KeyValueStore): Promise<void> {
  await kv.remove(API_KEY);
}
