import { describe, expect, it } from "vitest";

import { MODEL_CATALOG, mergeModels, parseModelsPage } from "../src/ai/models.js";

describe("parseModelsPage", () => {
  it("maps the Anthropic list shape into ModelInfo, keeping order", () => {
    const page = parseModelsPage({
      data: [
        {
          id: "claude-opus-4-8",
          display_name: "Claude Opus 4.8",
          created_at: "2026-01-01T00:00:00Z",
          max_input_tokens: 1_000_000,
          max_tokens: 128_000,
        },
        { id: "claude-sonnet-4-6", display_name: "Claude Sonnet 4.6" },
      ],
      has_more: false,
      last_id: "claude-sonnet-4-6",
    });

    expect(page.hasMore).toBe(false);
    expect(page.lastId).toBe("claude-sonnet-4-6");
    expect(page.models).toEqual([
      {
        id: "claude-opus-4-8",
        displayName: "Claude Opus 4.8",
        createdAt: "2026-01-01T00:00:00Z",
        maxInputTokens: 1_000_000,
        maxOutputTokens: 128_000,
      },
      { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
    ]);
  });

  it("keeps only Sonnet/Opus, drops other families and malformed entries", () => {
    const page = parseModelsPage({
      data: [
        { id: "gpt-4o", display_name: "Other" },
        { id: "claude-haiku-4-5", display_name: "Haiku" },
        { id: "claude-fable-5", display_name: "Fable" },
        { id: "claude-sonnet-4-6" },
        { id: "claude-opus-4-8", display_name: "Opus" },
        { display_name: "no id" },
        null,
      ],
    });

    expect(page.models).toEqual([
      { id: "claude-sonnet-4-6", displayName: "claude-sonnet-4-6" },
      { id: "claude-opus-4-8", displayName: "Opus" },
    ]);
    // Missing has_more / last_id default to a terminal page.
    expect(page.hasMore).toBe(false);
    expect(page.lastId).toBeUndefined();
  });

  it("tolerates a missing or empty body", () => {
    expect(parseModelsPage(undefined).models).toEqual([]);
    expect(parseModelsPage({}).models).toEqual([]);
  });
});

describe("mergeModels", () => {
  it("keeps the live entry when ids collide and appends unseen fallbacks", () => {
    const fetched = [
      { id: "claude-opus-4-8", displayName: "Live Opus", maxInputTokens: 1_000_000 },
    ];

    const merged = mergeModels(fetched);

    // Live entry wins for the shared id…
    expect(merged[0]).toEqual(fetched[0]);
    // …and every catalog model still appears exactly once.
    const ids = merged.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const model of MODEL_CATALOG) {
      expect(ids).toContain(model.id);
    }
  });

  it("returns the full fallback catalog when nothing was fetched", () => {
    expect(mergeModels([])).toEqual(MODEL_CATALOG);
  });
});
