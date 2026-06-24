import { describe, expect, it } from "vitest";

import { MemoryKeyValueStore } from "../src/persistence/kv.js";
import {
  clearStoredApiKey,
  getStoredApiKey,
  setStoredApiKey,
} from "../src/persistence/secretStore.js";

describe("secretStore", () => {
  it("stores, reads, and clears the API key", async () => {
    const kv = new MemoryKeyValueStore();
    expect(await getStoredApiKey(kv)).toBeUndefined();

    await setStoredApiKey(kv, "sk-ant-123");
    expect(await getStoredApiKey(kv)).toBe("sk-ant-123");

    await clearStoredApiKey(kv);
    expect(await getStoredApiKey(kv)).toBeUndefined();
  });

  it("treats an empty stored value as absent", async () => {
    const kv = new MemoryKeyValueStore();
    await setStoredApiKey(kv, "");
    expect(await getStoredApiKey(kv)).toBeUndefined();
  });

  it("keeps the secret out of the project key namespace", async () => {
    const kv = new MemoryKeyValueStore();
    await setStoredApiKey(kv, "sk-ant-123");
    const keys = await kv.keys();
    expect(keys.some((key) => key.startsWith("project:"))).toBe(false);
  });
});
