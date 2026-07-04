import { DEFAULT_TARGET } from "@schema-studio/core";
import { describe, expect, it } from "vitest";

import { LocalBrowserProvider } from "../src/ai/LocalBrowserProvider.js";
import {
  PROVIDER_IDS,
  PROVIDERS,
  decodeProviderModel,
  effectiveCredential,
  encodeProviderModel,
  toProviderId,
} from "../src/ai/providers.js";

describe("toProviderId", () => {
  it("accepts every known provider and defaults unknowns to anthropic", () => {
    expect(toProviderId("anthropic")).toBe("anthropic");
    expect(toProviderId("openai")).toBe("openai");
    expect(toProviderId("local")).toBe("local");
    expect(toProviderId("nonsense")).toBe("anthropic");
    expect(toProviderId(null)).toBe("anthropic");
  });
});

describe("local provider registry entry", () => {
  it("is an endpoint-credentialed provider with a default endpoint and empty catalog", () => {
    const meta = PROVIDERS.local;
    expect(meta.credentialKind).toBe("endpoint");
    expect(meta.defaultCredential).toBe("http://localhost:11434/v1");
    expect(meta.catalog).toEqual([]);
    // No default model — the copilot must never post an empty model id; a concrete model has to be
    // picked from the live list first (guards against reintroducing `defaultModel: ""`).
    expect(meta.defaultModel).toBeUndefined();
  });

  it("builds a LocalBrowserProvider from its factory", () => {
    const provider = PROVIDERS.local.create("http://localhost:1234/v1", "llama3.1", DEFAULT_TARGET);
    expect(provider).toBeInstanceOf(LocalBrowserProvider);
  });
});

describe("PROVIDER_IDS", () => {
  it("includes local so it is iterated by the segment/menu/key surfaces", () => {
    expect(PROVIDER_IDS).toContain("local");
  });
});

describe("effectiveCredential", () => {
  it("prefers an entered credential, trimming whitespace", () => {
    expect(effectiveCredential("openai", "  sk-abc  ")).toBe("sk-abc");
    expect(effectiveCredential("local", "http://host:9/v1")).toBe("http://host:9/v1");
  });

  it("falls back to local's default endpoint, and to empty for keyless key providers", () => {
    // Local is ready with no input; key providers are not.
    expect(effectiveCredential("local", "")).toBe("http://localhost:11434/v1");
    expect(effectiveCredential("openai", "")).toBe("");
    expect(effectiveCredential("anthropic", "   ")).toBe("");
  });
});

describe("encode/decode provider+model still round-trips with local", () => {
  it("survives a local pair", () => {
    const encoded = encodeProviderModel("local", "llama3.1:8b");
    expect(decodeProviderModel(encoded)).toEqual({ provider: "local", model: "llama3.1:8b" });
  });
});
