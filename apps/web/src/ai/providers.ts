import type { AiProvider, ModelInfo, TargetId } from "@schema-studio/core";

import { AnthropicBrowserProvider } from "./AnthropicBrowserProvider.js";
import { LocalBrowserProvider } from "./LocalBrowserProvider.js";
import { OpenAiBrowserProvider } from "./OpenAiBrowserProvider.js";
import { LOCAL_DEFAULT_ENDPOINT, LOCAL_MODEL_CATALOG } from "./localModels.js";
import { DEFAULT_MODEL, MODEL_CATALOG } from "./models.js";
import { OPENAI_DEFAULT_MODEL, OPENAI_MODEL_CATALOG } from "./openaiModels.js";

/** The AI providers the app can talk to: two BYO-key cloud providers plus a local runtime. */
export type ProviderId = "anthropic" | "openai" | "local";

/**
 * Whether a provider is credentialed by a secret API key or by a server URL. The BYO-key page keys
 * its input treatment (label, masking, validation) off this, so `"local"` gets a plain URL field
 * instead of a masked key field.
 */
export type CredentialKind = "key" | "endpoint";

/**
 * Everything the app needs to know about one provider, so no consumer hardcodes Anthropic:
 * display copy, the credential shape + soft-validation prefix, the console URL, the picker's
 * default model + static fallback catalog, and a factory that builds the concrete {@link AiProvider}.
 */
export type ProviderMeta = {
  id: ProviderId;
  label: string;
  /** Whether the provider's credential is a secret key or a server URL. */
  credentialKind: CredentialKind;
  /** Soft-validation prefix for the credential input (e.g. "sk-ant-", or "http" for an endpoint). */
  keyPrefix: string;
  keyPlaceholder: string;
  keysUrl: string;
  /**
   * The model selected when the user hasn't chosen one. Optional: local has no fixed default (its
   * model set is whatever the running server serves), so it omits this — a provider with no
   * `defaultModel` isn't chat-ready until a concrete model is picked, which stops the copilot from
   * ever posting an empty model id.
   */
  defaultModel?: string;
  /**
   * A credential to fall back to when the user hasn't set one. Only local has this (its default
   * endpoint), which is what lets the local provider work with zero setup. Key providers omit it,
   * so they stay unusable until a key is entered.
   */
  defaultCredential?: string;
  /** Static fallback catalog for the model picker when the live list can't be fetched. */
  catalog: ModelInfo[];
  create(credential: string, model: string, target: TargetId): AiProvider;
};

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    credentialKind: "key",
    keyPrefix: "sk-ant-",
    keyPlaceholder: "sk-ant-api03-…",
    keysUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: DEFAULT_MODEL,
    catalog: MODEL_CATALOG,
    create: (apiKey, model, target) => new AnthropicBrowserProvider(apiKey, model, target),
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    credentialKind: "key",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-…",
    keysUrl: "https://platform.openai.com/api-keys",
    defaultModel: OPENAI_DEFAULT_MODEL,
    catalog: OPENAI_MODEL_CATALOG,
    create: (apiKey, model, target) => new OpenAiBrowserProvider(apiKey, model, target),
  },
  local: {
    id: "local",
    label: "Local",
    credentialKind: "endpoint",
    keyPrefix: "http",
    keyPlaceholder: LOCAL_DEFAULT_ENDPOINT,
    keysUrl: "https://ollama.com/download",
    // No default model: the set depends on what the running server serves, so local isn't
    // chat-ready until the user picks one from the live `/models` list (see useAiProvider).
    defaultCredential: LOCAL_DEFAULT_ENDPOINT,
    catalog: LOCAL_MODEL_CATALOG,
    create: (endpoint, model, target) => new LocalBrowserProvider(endpoint, model, target),
  },
};

/** Stable ordered list of provider ids, for iterating segments/menus. */
export const PROVIDER_IDS: ProviderId[] = ["anthropic", "openai", "local"];

/** Narrow an arbitrary string to a known {@link ProviderId}, defaulting to Anthropic. */
export function toProviderId(value: unknown): ProviderId {
  return value === "openai" || value === "anthropic" || value === "local" ? value : "anthropic";
}

/**
 * The credential a provider will actually use for a call: the user's stored key/URL when set,
 * otherwise the provider's {@link ProviderMeta.defaultCredential} (only local has one). Empty string
 * means "not usable yet" — the single readiness signal shared by the provider factory, the model
 * fetch, and every UI gate, so local's zero-setup default is honored in exactly one place.
 */
export function effectiveCredential(id: ProviderId, storedKey: string): string {
  return storedKey.trim() || PROVIDERS[id].defaultCredential || "";
}

// A `<select>` option value can only carry a string, so a (provider, model) pair is encoded as
// one. Both sides go through these helpers so the separator convention lives in exactly one place.
const PAIR_SEPARATOR = "::";

/** Encode a (provider, model) pair into a single option-value string. */
export function encodeProviderModel(provider: ProviderId, model: string): string {
  return `${provider}${PAIR_SEPARATOR}${model}`;
}

/** Decode an option-value string back into a (provider, model) pair, or null if malformed. */
export function decodeProviderModel(value: string): { provider: ProviderId; model: string } | null {
  const separator = value.indexOf(PAIR_SEPARATOR);
  if (separator === -1) {
    return null;
  }
  return {
    provider: toProviderId(value.slice(0, separator)),
    model: value.slice(separator + PAIR_SEPARATOR.length),
  };
}
