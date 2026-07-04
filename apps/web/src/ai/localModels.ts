import type { ModelInfo } from "@schema-studio/core";

/**
 * The default local endpoint: Ollama's OpenAI-compatible base URL. LM Studio (`:1234/v1`),
 * llama.cpp, and vLLM expose the same `/v1/chat/completions` + `/v1/models` surface, so the user
 * only changes this URL — the wire format is identical. Chosen as the default because Ollama is the
 * most common local runtime.
 */
export const LOCAL_DEFAULT_ENDPOINT = "http://localhost:11434/v1";

/**
 * No static catalog. Which models a local server can serve depends entirely on what the user has
 * pulled, so the picker is populated live from `GET {endpoint}/models` — there is nothing sensible
 * to hard-code. Kept as a named export so the provider registry reads like the others.
 */
export const LOCAL_MODEL_CATALOG: ModelInfo[] = [];

/** Shape of one entry in an OpenAI-compatible `GET /v1/models` response `data` array. */
type RawModel = {
  id?: unknown;
  created?: unknown;
};

function toModelInfo(raw: unknown): ModelInfo | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const entry = raw as RawModel;
  if (typeof entry.id !== "string" || !entry.id) {
    return null;
  }
  return {
    id: entry.id,
    // Local runtimes report no display name — the model id is the friendly-enough label.
    displayName: entry.id,
    // `created` is a Unix timestamp (seconds) when present; normalize to ISO like the others.
    ...(typeof entry.created === "number"
      ? { createdAt: new Date(entry.created * 1000).toISOString() }
      : {}),
  };
}

/**
 * Parse an OpenAI-compatible `GET /v1/models` list into `ModelInfo`s. Unlike the hosted providers
 * there is NO family filtering: whatever the user pulled is fair game (the copilot's tool loop
 * still requires a tool-capable model, but that is the user's choice to make). Newest-first when
 * timestamps are present; stable otherwise.
 */
export function parseLocalModels(json: unknown): ModelInfo[] {
  const body = (json ?? {}) as { data?: unknown };
  const data = Array.isArray(body.data) ? body.data : [];
  const models = data
    .map((entry) => toModelInfo(entry))
    .filter((model): model is ModelInfo => model !== null);
  return models.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
